import {
  Play,
  Pause,
  Menu,
  Info,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  PlusCircle,
  Music,
  Heart,
  Trash2,
  ArrowUpDown,
  Type,
  User,
  Disc,
  Star,
  ArrowUp,
  ArrowDown,
  X,
  ListChecks,
  List,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Edit,
  Share,
  Download,
  Upload,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Volume1,
  VolumeOff,
  BarChart3,
  PictureInPicture2,
  Sun,
  Moon,
  SunMoon,
  Check,
  Pencil,
  Save,
  Palette,
  RotateCcw,
  Keyboard,
  MessageCircle,
  SlidersHorizontal,
  CircleQuestionMark,
} from "lucide-react";
import type {
  IconDefinition,
  IconDefinitionMap,
  IconLibraryMap,
  IconLibraryConfigMap,
  IconPropTransformer,
} from "../../../types/icons";

export const libraries: IconLibraryMap = {
  lucide: {
    Play,
    Pause,
    Menu,
    Info,
    Settings,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Search,
    Plus,
    PlusCircle,
    Music,
    Heart,
    Trash2,
    ArrowUpDown,
    Type,
    User,
    Disc,
    Star,
    ArrowUp,
    ArrowDown,
    X,
    ListChecks,
    List,
    ThumbsUp,
    ThumbsDown,
    MoreHorizontal,
    Edit,
    Share,
    Download,
    Upload,
    SkipBack,
    SkipForward,
    Repeat,
    Shuffle,
    Volume2,
    VolumeX,
    Volume1,
    VolumeOff,
    BarChart3,
    PictureInPicture2,
    Sun,
    Moon,
    SunMoon,
    Check,
    Pencil,
    Save,
    Palette,
    RotateCcw,
    Keyboard,
    MessageCircle,
    SlidersHorizontal,
    CircleQuestionMark
  },
};

// Lucide-react accepts: size, color, strokeWidth, absoluteStrokeWidth, etc.
const lucidePropTransformer: IconPropTransformer = (props) => {
  const transformed: Record<string, any> = {};

  // Lucide uses 'size' prop directly for both width and height
  if (props.size !== undefined) {
    transformed.size = props.size;
  }

  // Pass color and stroke props as-is
  if (props.color !== undefined) transformed.color = props.color;
  if (props.stroke !== undefined) transformed.stroke = props.stroke;
  if (props.strokeWidth !== undefined) transformed.strokeWidth = props.strokeWidth;
  if (props.fill !== undefined) transformed.fill = props.fill;

  return transformed;
};

export const libraryConfig: IconLibraryConfigMap = {
  lucide: {
    propTransformer: lucidePropTransformer,
  },
};

const lucideIcon = (
  icon: string,
  title?: string
): IconDefinition => ({
  type: "library",
  library: "lucide",
  icon,
  title,
});

const icons: IconDefinitionMap = {
  play: lucideIcon("Play", "Play"),
  pause: lucideIcon("Pause", "Pause"),
  menu: lucideIcon("Menu"),
  info: lucideIcon("Info"),
  settings: lucideIcon("Settings"),
  chevronRight: lucideIcon("ChevronRight"),
  chevronDown: lucideIcon("ChevronDown"),
  chevronUp: lucideIcon("ChevronUp"),
  search: lucideIcon("Search"),
  plus: lucideIcon("Plus"),
  plusCircle: lucideIcon("PlusCircle"),
  music: lucideIcon("Music"),
  heart: lucideIcon("Heart"),
  trash2: lucideIcon("Trash2"),
  arrowUpDown: lucideIcon("ArrowUpDown"),
  type: lucideIcon("Type"),
  user: lucideIcon("User"),
  disc: lucideIcon("Disc"),
  star: lucideIcon("Star"),
  arrowUp: lucideIcon("ArrowUp"),
  arrowDown: lucideIcon("ArrowDown"),
  close: lucideIcon("X", "Close"),
  listChecks: lucideIcon("ListChecks"),
  list: lucideIcon("List"),
  thumbsUp: lucideIcon("ThumbsUp"),
  thumbsDown: lucideIcon("ThumbsDown"),
  moreHorizontal: lucideIcon("MoreHorizontal"),
  edit: lucideIcon("Edit"),
  share: lucideIcon("Share"),
  download: lucideIcon("Download"),
  upload: lucideIcon("Upload"),
  skipBack: lucideIcon("SkipBack"),
  skipForward: lucideIcon("SkipForward"),
  repeat: lucideIcon("Repeat"),
  shuffle: lucideIcon("Shuffle"),
  volume2: lucideIcon("Volume2"),
  volumeX: lucideIcon("VolumeX"),
  volume1: lucideIcon("Volume1"),
  volumeOff: lucideIcon("VolumeOff"),
  barChart3: lucideIcon("BarChart3"),
  pictureInPicture2: lucideIcon("PictureInPicture2"),
  sun: lucideIcon("Sun"),
  moon: lucideIcon("Moon"),
  sunMoon: lucideIcon("SunMoon"),
  check: lucideIcon("Check"),
  pencil: lucideIcon("Pencil"),
  save: lucideIcon("Save"),
  palette: lucideIcon("Palette"),
  rotateCcw: lucideIcon("RotateCcw"),
  keyboard: lucideIcon("Keyboard"),
  messageCircle: lucideIcon("MessageCircle"),
  visualizerControls: lucideIcon("SlidersHorizontal"),
  circleQuestionMark: lucideIcon("CircleQuestionMark")
};

export default icons;
