import {
  SlControlPlay,
  SlControlPause,
  SlMenu,
  SlInfo,
  SlSettings,
  SlArrowRight,
  SlArrowDown,
  SlArrowUp,
  SlMagnifier,
  SlPlus,
  SlMusicToneAlt,
  SlHeart,
  SlTrash,
  SlOrganization,
  SlSizeFullscreen,
  SlUser,
  SlDisc,
  SlStar,
  SlClose,
  SlCheck,
  SlList,
  SlLike,
  SlDislike,
  SlOptions,
  SlPencil,
  SlShareAlt,
  SlCloudDownload,
  SlCloudUpload,
  SlControlStart,
  SlControlEnd,
  SlRefresh,
  SlShuffle,
  SlVolume2,
  SlVolumeOff,
  SlVolume1,
  SlGraph,
  SlPicture,
  SlEnergy,
  SlGlobe,
  SlDrawer,
  SlLayers,
  SlReload,
  SlCursorMove,
  SlSpeech,
} from "react-icons/sl";
import type {
  IconDefinition,
  IconDefinitionMap,
  IconLibraryMap,
  IconLibraryConfigMap,
  IconPropTransformer,
} from "../../../types/icons";

export const libraries: IconLibraryMap = {
  simpleline: {
    SlControlPlay,
    SlControlPause,
    SlMenu,
    SlInfo,
    SlSettings,
    SlArrowRight,
    SlArrowDown,
    SlArrowUp,
    SlMagnifier,
    SlPlus,
    SlMusicToneAlt,
    SlHeart,
    SlTrash,
    SlOrganization,
    SlSizeFullscreen,
    SlUser,
    SlDisc,
    SlStar,
    SlClose,
    SlCheck,
    SlList,
    SlLike,
    SlDislike,
    SlOptions,
    SlPencil,
    SlShareAlt,
    SlCloudDownload,
    SlCloudUpload,
    SlControlStart,
    SlControlEnd,
    SlRefresh,
    SlShuffle,
    SlVolume2,
    SlVolumeOff,
    SlVolume1,
    SlGraph,
    SlPicture,
    SlEnergy,
    SlGlobe,
    SlDrawer,
    SlLayers,
    SlReload,
    SlCursorMove,
    SlSpeech,
  },
};

// react-icons uses: size (as string or number), color, style, etc.
const simpleLinePropTransformer: IconPropTransformer = (props) => {
  const transformed: Record<string, any> = {};

  if (props.size !== undefined) {
    transformed.size = props.size;
  }

  if (props.color !== undefined) {
    transformed.color = props.color;
  }

  return transformed;
};

export const libraryConfig: IconLibraryConfigMap = {
  simpleline: {
    propTransformer: simpleLinePropTransformer,
  },
};

const simpleLineIcon = (
  icon: string,
  title?: string
): IconDefinition => ({
  type: "library",
  library: "simpleline",
  icon,
  title,
});

const icons: IconDefinitionMap = {
  play: simpleLineIcon("SlControlPlay", "Play"),
  pause: simpleLineIcon("SlControlPause", "Pause"),
  menu: simpleLineIcon("SlMenu"),
  info: simpleLineIcon("SlInfo"),
  settings: simpleLineIcon("SlSettings"),
  chevronRight: simpleLineIcon("SlArrowRight"),
  chevronDown: simpleLineIcon("SlArrowDown"),
  chevronUp: simpleLineIcon("SlArrowUp"),
  search: simpleLineIcon("SlMagnifier"),
  plus: simpleLineIcon("SlPlus"),
  plusCircle: simpleLineIcon("SlPlus"),
  music: simpleLineIcon("SlMusicToneAlt"),
  heart: simpleLineIcon("SlHeart"),
  trash2: simpleLineIcon("SlTrash"),
  arrowUpDown: simpleLineIcon("SlOrganization"),
  type: simpleLineIcon("SlSizeFullscreen"),
  user: simpleLineIcon("SlUser"),
  disc: simpleLineIcon("SlDisc"),
  star: simpleLineIcon("SlStar"),
  arrowUp: simpleLineIcon("SlArrowUp"),
  arrowDown: simpleLineIcon("SlArrowDown"),
  close: simpleLineIcon("SlClose", "Close"),
  listChecks: simpleLineIcon("SlCheck"), // No direct list-checks, use check
  list: simpleLineIcon("SlList"),
  thumbsUp: simpleLineIcon("SlLike"),
  thumbsDown: simpleLineIcon("SlDislike"),
  moreHorizontal: simpleLineIcon("SlOptions"),
  edit: simpleLineIcon("SlPencil"),
  share: simpleLineIcon("SlShareAlt"),
  download: simpleLineIcon("SlCloudDownload"),
  upload: simpleLineIcon("SlCloudUpload"),
  skipBack: simpleLineIcon("SlControlStart"),
  skipForward: simpleLineIcon("SlControlEnd"),
  repeat: simpleLineIcon("SlRefresh"),
  shuffle: simpleLineIcon("SlShuffle"),
  volume2: simpleLineIcon("SlVolume2"),
  volumeX: simpleLineIcon("SlVolumeOff"),
  volume1: simpleLineIcon("SlVolume1"),
  volumeOff: simpleLineIcon("SlVolumeOff"),
  barChart3: simpleLineIcon("SlGraph"),
  pictureInPicture2: simpleLineIcon("SlPicture"),
  sun: simpleLineIcon("SlEnergy"),
  moon: simpleLineIcon("SlGlobe"),
  sunMoon: simpleLineIcon("SlEnergy"), // No direct sun-moon, use sun
  check: simpleLineIcon("SlCheck"),
  pencil: simpleLineIcon("SlPencil"),
  save: simpleLineIcon("SlDrawer"),
  palette: simpleLineIcon("SlLayers"), // No direct palette, use layers
  rotateCcw: simpleLineIcon("SlReload"),
  keyboard: simpleLineIcon("SlCursorMove"), // No direct keyboard, use cursor
  messageCircle: simpleLineIcon("SlSpeech"),
  visualizerControls: simpleLineIcon("SlControlPlay")
};

export default icons;
