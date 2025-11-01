import {
    CgPlayButton,
    CgPlayPause,
    CgMenu,
    CgInfo,
    CgOptions,
    CgChevronRight,
    CgChevronDown,
    CgChevronUp,
    CgSearch,
    CgAdd,
    CgAddR,
    CgMusic,
    CgHeart,
    CgTrash,
    CgArrowsExchangeAltV,
    CgFormatText,
    CgProfile,
    CgDisc,
    CgAsterisk,
    CgClose,
    CgCheckO,
    CgList,
    CgSmile,
    CgSmileSad,
    CgMoreO,
    CgPen,
    CgShare,
    CgArrowDownO,
    CgArrowUpO,
    CgPlayTrackPrev,
    CgPlayTrackNext,
    CgRepeat,
    CgArrowsExchange,
    CgVolume,
    CgCloseO,
    CgChart,
    CgInpicture,
    CgSun,
    CgMoon,
    CgCheck,
    CgFile,
    CgColorBucket,
    CgRedo,
    CgKeyboard,
    CgComment,
    CgMusicSpeaker,
} from "react-icons/cg";
import type {
    IconDefinition,
    IconDefinitionMap,
    IconLibraryMap,
    IconLibraryConfigMap,
    IconPropTransformer,
} from "../../../types/icons";

const cssggIcons = {
    CgPlayButton,
    CgPlayPause,
    CgMenu,
    CgInfo,
    CgOptions,
    CgChevronRight,
    CgChevronDown,
    CgChevronUp,
    CgSearch,
    CgAdd,
    CgAddR,
    CgMusic,
    CgHeart,
    CgTrash,
    CgArrowsExchangeAltV,
    CgFormatText,
    CgProfile,
    CgDisc,
    CgAsterisk,
    CgClose,
    CgCheckO,
    CgList,
    CgSmile,
    CgSmileSad,
    CgMoreO,
    CgPen,
    CgShare,
    CgArrowDownO,
    CgArrowUpO,
    CgPlayTrackPrev,
    CgPlayTrackNext,
    CgRepeat,
    CgArrowsExchange,
    CgVolume,
    CgCloseO,
    CgChart,
    CgInpicture,
    CgSun,
    CgMoon,
    CgCheck,
    CgFile,
    CgColorBucket,
    CgRedo,
    CgKeyboard,
    CgComment,
    CgMusicSpeaker,
};

export const libraries: IconLibraryMap = {
    cssgg: cssggIcons,
};

// css.gg React icons typically use: className, style, color, size, etc.
const cssggPropTransformer: IconPropTransformer = (props) => {
    const transformed: Record<string, any> = {};

    if (props.size !== undefined) {
        transformed.size = props.size;
    }
    if (props.color !== undefined) {
        transformed.color = props.color;
    }
    if (props.className !== undefined) {
        transformed.className = props.className;
    }
    if (props.style !== undefined) {
        transformed.style = props.style;
    }

    return transformed;
};

export const libraryConfig: IconLibraryConfigMap = {
    cssgg: {
        propTransformer: cssggPropTransformer,
    },
};

const cssggIcon = (
    icon: keyof typeof cssggIcons,
    title?: string
): IconDefinition => ({
    type: "library",
    library: "cssgg",
    icon,
    title,
});

const icons: IconDefinitionMap = {
    play: cssggIcon("CgPlayButton"),
    pause: cssggIcon("CgPlayPause"),
    menu: cssggIcon("CgMenu"),
    info: cssggIcon("CgInfo"),
    settings: cssggIcon("CgOptions"),
    chevronRight: cssggIcon("CgChevronRight"),
    chevronDown: cssggIcon("CgChevronDown"),
    chevronUp: cssggIcon("CgChevronUp"),
    search: cssggIcon("CgSearch"),
    plus: cssggIcon("CgAdd"),
    plusCircle: cssggIcon("CgAddR"),
    music: cssggIcon("CgMusic"),
    heart: cssggIcon("CgHeart"),
    trash2: cssggIcon("CgTrash"),
    arrowUpDown: cssggIcon("CgArrowsExchangeAltV"),
    type: cssggIcon("CgFormatText"),
    user: cssggIcon("CgProfile"),
    disc: cssggIcon("CgDisc"),
    star: cssggIcon("CgAsterisk"),
    arrowUp: cssggIcon("CgChevronUp"),
    arrowDown: cssggIcon("CgChevronDown"),
    close: cssggIcon("CgClose", "Close"),
    listChecks: cssggIcon("CgCheckO"),
    list: cssggIcon("CgList"),
    thumbsUp: cssggIcon("CgSmile"),
    thumbsDown: cssggIcon("CgSmileSad"),
    moreHorizontal: cssggIcon("CgMoreO"),
    edit: cssggIcon("CgPen"),
    share: cssggIcon("CgShare"),
    download: cssggIcon("CgArrowDownO"),
    upload: cssggIcon("CgArrowUpO"),
    skipBack: cssggIcon("CgPlayTrackPrev"),
    skipForward: cssggIcon("CgPlayTrackNext"),
    repeat: cssggIcon("CgRepeat"),
    shuffle: cssggIcon("CgArrowsExchange"),
    volume2: cssggIcon("CgVolume"),
    volumeX: cssggIcon("CgCloseO"),
    volume1: cssggIcon("CgVolume"),
    volumeOff: cssggIcon("CgCloseO"),
    barChart3: cssggIcon("CgChart"),
    pictureInPicture2: cssggIcon("CgInpicture"),
    sun: cssggIcon("CgSun"),
    moon: cssggIcon("CgMoon"),
    sunMoon: cssggIcon("CgSun"),
    check: cssggIcon("CgCheck"),
    pencil: cssggIcon("CgPen"),
    save: cssggIcon("CgFile"),
    palette: cssggIcon("CgColorBucket"),
    rotateCcw: cssggIcon("CgRedo"),
    keyboard: cssggIcon("CgKeyboard"),
    messageCircle: cssggIcon("CgComment"),
    visualizerControls: cssggIcon("CgMusicSpeaker")
};

export default icons;
