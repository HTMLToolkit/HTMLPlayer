use std::cmp;
use std::io::{self, Read, Seek, SeekFrom};
use std::sync::{Arc, Mutex};

use js_sys::Float32Array;
use symphonia::core::codecs::audio::{AudioDecoder, AudioDecoderOptions};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::well_known::{
    FORMAT_ID_ADTS, FORMAT_ID_FLAC, FORMAT_ID_MP1, FORMAT_ID_MP2, FORMAT_ID_MP3, FORMAT_ID_WAVE,
};
use symphonia::core::formats::{FormatOptions, FormatReader, TrackType};
use symphonia::core::io::{MediaSource, MediaSourceStream};
use symphonia::core::meta::MetadataOptions;
use wasm_bindgen::prelude::*;

struct SharedBuffer(Arc<Mutex<Vec<u8>>>);

impl SharedBuffer {
    const GUARD: &'static str = "single-threaded decoder lock is never poisoned";

    fn new() -> SharedBuffer {
        SharedBuffer(Arc::new(Mutex::new(Vec::new())))
    }

    fn clone_shared(&self) -> SharedBuffer {
        SharedBuffer(self.0.clone())
    }

    fn len(&self) -> usize {
        self.0.lock().expect(Self::GUARD).len()
    }

    fn read_into(&self, pos: usize, buf: &mut [u8]) -> usize {
        let data = self.0.lock().expect(Self::GUARD);
        if pos >= data.len() {
            // A seek can place pos past the bytes fed so far
            return 0;
        }
        let len = cmp::min(buf.len(), data.len() - pos);
        buf[..len].copy_from_slice(&data[pos..pos + len]);
        len
    }

    fn append(&self, bytes: &[u8]) {
        self.0.lock().expect(Self::GUARD).extend_from_slice(bytes);
    }
}

struct ByteSource {
    data: SharedBuffer,
    pos: usize,
}

impl Read for ByteSource {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let len = self.data.read_into(self.pos, buf);
        self.pos += len;
        Ok(len)
    }
}

impl Seek for ByteSource {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(offset) => offset as i64,
            SeekFrom::Current(delta) => self.pos as i64 + delta,
            SeekFrom::End(delta) => self.data.len() as i64 + delta,
        };
        if new_pos < 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "seek before start of buffer",
            ));
        }
        self.pos = new_pos as usize;
        Ok(self.pos as u64)
    }
}

impl MediaSource for ByteSource {
    fn is_seekable(&self) -> bool {
        true
    }

    fn byte_len(&self) -> Option<u64> {
        Some(self.data.len() as u64)
    }
}

/// Stream parameters reported once the codec header is decoded.
#[wasm_bindgen]
#[derive(Clone)]
pub struct DecoderInfo {
    sample_rate: u32,
    channels: u32,
    bit_depth: u32,
    total_samples: f64,
    codec: String,
}

#[wasm_bindgen]
impl DecoderInfo {
    #[wasm_bindgen(getter)]
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.channels
    }

    #[wasm_bindgen(getter)]
    pub fn bit_depth(&self) -> u32 {
        self.bit_depth
    }

    #[wasm_bindgen(getter)]
    pub fn total_samples(&self) -> f64 {
        self.total_samples
    }

    #[wasm_bindgen(getter)]
    pub fn codec(&self) -> String {
        self.codec.clone()
    }
}

/// Outcome of attempting to open the container before all input has arrived.
enum OpenState {
    Opened,
    /// The probe needs more bytes before the container can be parsed.
    NeedMoreInput,
    /// The input can never be decoded.
    Failed,
}

#[wasm_bindgen]
pub struct SymphoniaDecoder {
    data: SharedBuffer,
    input_ended: bool,
    opened: bool,
    format: Option<Box<dyn FormatReader>>,
    decoder: Option<Box<dyn AudioDecoder>>,
    track_id: u32,
    info: Option<DecoderInfo>,
    decoded: Vec<f32>,
    error: Option<String>,
    finished: bool,
    pending: bool,
    budget_exhausted: bool,
    packets_this_call: u32,
    consecutive_errors: u32,
    container_seen: bool,
    streamable: bool,
}

#[wasm_bindgen]
impl SymphoniaDecoder {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SymphoniaDecoder {
        // Log the panic message and location to console
        console_error_panic_hook::set_once();
        SymphoniaDecoder {
            data: SharedBuffer::new(),
            input_ended: false,
            opened: false,
            format: None,
            decoder: None,
            track_id: 0,
            info: None,
            decoded: Vec::new(),
            error: None,
            finished: false,
            pending: false,
            budget_exhausted: false,
            packets_this_call: 0,
            consecutive_errors: 0,
            container_seen: false,
            streamable: false,
        }
    }

    pub fn feed(&mut self, bytes: &[u8]) -> bool {
        if self.input_ended {
            return false;
        }
        self.data.append(bytes);
        true
    }

    /// Marks the end of the input byte stream. Container parsing may still
    /// require the complete file (e.g. an MP4 `moov` atom at the end), so
    /// decode can only begin once this has been called for such files.
    pub fn end_of_input(&mut self) {
        self.input_ended = true;
    }

    pub fn has_error(&self) -> bool {
        self.error.is_some()
    }

    pub fn error_message(&self) -> Option<String> {
        self.error.clone()
    }

    /// Reports whether the previous `next_frame` call stopped because more
    /// input bytes are required (rather than because the stream ended).
    pub fn is_pending(&self) -> bool {
        self.pending
    }

    /// Reports whether the previous `next_frame` call reached the end of the
    /// decoded stream.
    pub fn is_finished(&self) -> bool {
        self.finished
    }

    /// Reports whether the previous `next_frame` call exhausted its per-call
    /// packet budget and returned without examining every queued packet. The
    /// host should resume decoding on a later turn so the main thread stays
    /// responsive while large streams decode.
    pub fn budget_exhausted(&self) -> bool {
        self.budget_exhausted
    }

    pub fn get_info(&mut self) -> Option<DecoderInfo> {
        match self.open() {
            OpenState::Opened => self.info.clone(),
            // Nothing useful to report until the container opens, but not an
            // error: the host keeps feeding bytes and drains again.
            OpenState::NeedMoreInput => None,
            OpenState::Failed => None,
        }
    }

    /// Decodes and returns the next packet as an interleaved f32 `Float32Array`
    /// in the stream's native channel order, or `null` when the callback should
    /// stop. Consult `is_pending`, `is_finished`, and `budget_exhausted` to
    /// distinguish "wait for more input" from "stream over" from "resume on a
    /// later turn".
    pub fn next_frame(&mut self) -> Option<Float32Array> {
        self.packets_this_call = 0;
        self.pending = false;
        self.budget_exhausted = false;

        if self.error.is_some() {
            return None;
        }
        match self.open() {
            OpenState::Opened => {}
            OpenState::NeedMoreInput => {
                self.pending = true;
                return None;
            }
            OpenState::Failed => return None,
        }

        // Buffered containers must not have packets decoded until the full
        // input is present: a frame split across a feed boundary corrupts the
        // demuxer state (the ring source has already consumed it) and produces
        // endless decode errors instead of a clean retry.
        if !self.input_ended && !self.streamable {
            self.pending = true;
            return None;
        }

        loop {
            if self.packets_this_call >= MAX_PACKETS_PER_CALL {
                self.budget_exhausted = true;
                return None;
            }

            let Some(format) = self.format.as_mut() else {
                self.fail("input was not opened".to_string());
                return None;
            };
            let packet = match format.next_packet() {
                Ok(Some(packet)) => packet,
                Ok(None) => {
                    // Some demuxers (notably MPEG) report end-of-stream when a
                    // frame is split across a feed boundary, so treat it as a
                    // stall unless all input has arrived.
                    if self.input_ended {
                        self.finished = true;
                    } else {
                        self.pending = true;
                    }
                    return None;
                }
                Err(SymphoniaError::IoError(ref e)) if e.kind() == io::ErrorKind::UnexpectedEof => {
                    if self.input_ended {
                        self.finished = true;
                    } else {
                        self.pending = true;
                    }
                    return None;
                }
                Err(SymphoniaError::ResetRequired)
                | Err(SymphoniaError::DecodeError(_)) => {
                    // Before input ends a demux hiccup is usually a frame split
                    // across a feed boundary. Wait for more bytes rather than
                    // burning the error budget on a temporarily incomplete
                    // packet.
                    if !self.input_ended {
                        self.pending = true;
                        return None;
                    }
                    if !self.recover_from_demux_error() {
                        return None;
                    }
                    continue;
                }
                Err(ref e) => {
                    self.fail(format!("symphonia demuxer error: {e}"));
                    return None;
                }
            };

            self.packets_this_call += 1;

            if packet.track_id != self.track_id {
                continue;
            }

            let Some(decoder) = self.decoder.as_mut() else {
                self.fail("decoder was not opened".to_string());
                return None;
            };
            let decoded = match decoder.decode(&packet) {
                Ok(decoded) => decoded,
                Err(SymphoniaError::DecodeError(_))
                | Err(SymphoniaError::ResetRequired) => {
                    // As above: a split frame at a feed boundary reads as a
                    // decode error. Wait for more input instead of skipping.
                    if !self.input_ended {
                        self.pending = true;
                        return None;
                    }
                    if !self.recover_from_decode_error() {
                        return None;
                    }
                    continue;
                }
                Err(SymphoniaError::IoError(ref e)) if e.kind() == io::ErrorKind::UnexpectedEof => {
                    if self.input_ended {
                        self.finished = true;
                    } else {
                        self.pending = true;
                    }
                    return None;
                }
                Err(ref e) => {
                    self.fail(format!("symphonia decode error: {e}"));
                    return None;
                }
            };
            self.consecutive_errors = 0;

            let num_samples = decoded.num_planes() * decoded.frames();
            self.decoded.resize(num_samples, 0.0);
            decoded.copy_to_slice_interleaved(&mut self.decoded[..]);

            let output = Float32Array::new_with_length(num_samples as u32);
            output.copy_from(&self.decoded);
            return Some(output);
        }
    }

    pub fn free(&mut self) {
        self.format = None;
        self.decoder = None;
        self.decoded = Vec::new();
        self.error = None;
    }
}

impl Default for SymphoniaDecoder {
    fn default() -> Self {
        Self::new()
    }
}

impl SymphoniaDecoder {
    fn open(&mut self) -> OpenState {
        if self.error.is_some() {
            return OpenState::Failed;
        }
        if self.opened {
            return OpenState::Opened;
        }
        if self.container_seen && !self.input_ended {
            // A buffered container needs the full file before it can open.
            return OpenState::NeedMoreInput;
        }
        if self.input_ended && self.data.len() == 0 {
            return OpenState::Failed;
        }

        // Re-probing on every call keeps the shared source feed in sync: once
        // enough bytes arrive for the container to be parsed, this succeeds.
        // Probe failures on complete input are real errors; on partial input
        // they mean "not enough bytes yet".
        let hint = Hint::new();
        let source = MediaSourceStream::new(
            Box::new(ByteSource {
                data: self.data.clone_shared(),
                pos: 0,
            }),
            Default::default(),
        );

        let format = match symphonia::default::get_probe().probe(
            &hint,
            source,
            FormatOptions::default(),
            MetadataOptions::default(),
        ) {
            Ok(format) => {
                // A probe success on incomplete input is only usable for
                // stream-safe formats. Buffered containers fix the container
                // length from the bytes present at open time, so opening them
                // early leaves that length stale for the real decode.
                if !self.input_ended
                    && !matches!(
                        format.format_info().format,
                        FORMAT_ID_MP1
                            | FORMAT_ID_MP2
                            | FORMAT_ID_MP3
                            | FORMAT_ID_ADTS
                            | FORMAT_ID_FLAC
                            | FORMAT_ID_WAVE
                    )
                {
                    self.container_seen = true;
                    drop(format);
                    return OpenState::NeedMoreInput;
                }
                format
            }
            // While input is still arriving any probe failure may just mean the
            // container is incomplete (e.g. an MP4 whose trailing `moov` atom
            // has not been fed yet). Defer the verdict until input ends.
            Err(_) if !self.input_ended => return OpenState::NeedMoreInput,
            Err(SymphoniaError::IoError(ref e)) if e.kind() == io::ErrorKind::UnexpectedEof => {
                self.fail("symphonia could not parse the input: truncated stream".to_string());
                return OpenState::Failed;
            }
            Err(e) => {
                self.fail(format!("symphonia could not recognize the input: {e}"));
                return OpenState::Failed;
            }
        };

        let track = match format.default_track(TrackType::Audio) {
            Some(track) => track,
            None => {
                self.fail("input contains no audio tracks".to_string());
                return OpenState::Failed;
            }
        };

        let Some(params) = track.codec_params.as_ref().and_then(|p| p.audio()) else {
            self.fail("input track has no audio codec parameters".to_string());
            return OpenState::Failed;
        };

        let decoder = match symphonia::default::get_codecs()
            .make_audio_decoder(params, &AudioDecoderOptions::default())
        {
            Ok(decoder) => decoder,
            Err(e) => {
                self.fail(format!("no decoder available for this codec: {e}"));
                return OpenState::Failed;
            }
        };

        let num_frames = track.num_frames.map(|frames| frames as f64).unwrap_or(0.0);
        self.track_id = track.id;
        self.info = Some(DecoderInfo {
            sample_rate: params.sample_rate.unwrap_or(0),
            channels: params
                .channels
                .as_ref()
                .map(|channels| channels.count() as u32)
                .unwrap_or(0),
            bit_depth: params.bits_per_sample.unwrap_or(0),
            total_samples: num_frames,
            codec: decoder.codec_info().short_name.to_string(),
        });

        self.format = Some(format);
        self.decoder = Some(decoder);
        self.streamable = self.is_stream_safe_format();
        self.opened = true;
        OpenState::Opened
    }

    fn is_stream_safe_format(&self) -> bool {
        let Some(format) = self.format.as_ref() else {
            return false;
        };
        matches!(
            format.format_info().format,
            FORMAT_ID_MP1
                | FORMAT_ID_MP2
                | FORMAT_ID_MP3
                | FORMAT_ID_ADTS
                | FORMAT_ID_FLAC
                | FORMAT_ID_WAVE
        )
    }

    /// Skips a demuxer level error. Returns `false` (and records a fatal
    /// failure) once the error budget is exhausted to avoid hanging on a
    /// stream that produces only errors.
    fn recover_from_demux_error(&mut self) -> bool {
        self.recover("symphonia demuxer stopped making progress")
    }

    /// Skips a decoder level error. Returns `false` (and records a fatal
    /// failure) once the error budget is exhausted to avoid hanging on a
    /// stream that produces only errors.
    fn recover_from_decode_error(&mut self) -> bool {
        self.recover("symphonia decoder stopped making progress")
    }

    fn recover(&mut self, message: &str) -> bool {
        self.consecutive_errors += 1;
        if self.consecutive_errors >= MAX_CONSECUTIVE_ERRORS {
            self.fail(message.to_string());
            return false;
        }
        true
    }

    fn fail(&mut self, message: String) {
        if self.error.is_none() {
            self.error = Some(message);
        }
    }
}

/// Packets examined per `next_frame` call in order to stay co-operative so the
/// browser main thread can service layout, input, and the audio clock while a
/// large file decodes. Roughly one to a few seconds of audio per call.
const MAX_PACKETS_PER_CALL: u32 = 256;
/// Worst-case consecutive recoverable errors before a stream is declared fatal.
const MAX_CONSECUTIVE_ERRORS: u32 = 128;