// Google Fonts Icons (Material Symbols Outlined) から書き出した SVG パスをそのまま埋め込む。
// 外部フォント/CDN には依存せず、使うアイコンだけをこのファイルにローカル同梱している。
// https://fonts.google.com/icons

interface IconProps {
  size?: number;
  className?: string;
}

// アイコンサイズの基準(隣接するテキストの font-size にほぼ合わせる)。
// サイズをファイルごとに決め打ちせず、ここに集約する。
export const ICON_SIZE = {
  sm: 11, // text-[10px]〜text-[11px] の一覧メタ情報バッジ
  md: 12, // text-xs のチップ・インラインボタン
  lg: 13, // text-sm の行・ボタン
  xl: 16, // 単体でタップ領域が必要なアイコンボタン
} as const;

function Icon({
  path,
  size = 16,
  className,
}: IconProps & { path: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

type IconComponent = (props: IconProps) => React.ReactElement;

// 「アイコン + テキスト」を1行で並べる、一覧バッジ/チップ用の共有コンポーネント。
// gap やサイズが呼び出し側ごとにバラつかないよう、ここで既定値を固定する。
//
// truncate=true のとき、親要素(祖先の `truncate` 付きボタンなど)の省略記号(…)を
// 壊さないよう、テキスト部分を独自の `truncate` 付き block/flex 要素として切り出す。
// (アイコン+テキストを単純に inline-flex で束ねると、祖先の text-overflow:ellipsis が
// そのアトミックなボックスごとクリップしてしまい、「…」が出ないまま欠けて見える)
export function IconText({
  icon: IconComp,
  size = ICON_SIZE.sm,
  gap = "gap-1",
  className = "",
  truncate = false,
  children,
}: {
  icon: IconComponent;
  size?: number;
  gap?: string;
  className?: string;
  truncate?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`${truncate ? "flex min-w-0" : "inline-flex"} items-center ${gap} ${className}`}
    >
      <IconComp size={size} className="shrink-0" />
      {truncate ? <span className="truncate min-w-0">{children}</span> : children}
    </span>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M200-120v-680h343l19 86h238v370H544l-18.93-85H260v309h-60Zm300-452Zm95 168h145v-250H511l-19-86H260v251h316l19 85Z"
    />
  );
}

export function ScheduleIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="m627-287 45-45-159-160v-201h-60v225l174 181ZM480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-82 31.5-155t86-127.5Q252-817 325-848.5T480-880q82 0 155 31.5t127.5 86Q817-708 848.5-635T880-480q0 82-31.5 155t-86 127.5Q708-143 635-111.5T480-80Zm0-400Zm0 340q140 0 240-100t100-240q0-140-100-240T480-820q-140 0-240 100T140-480q0 140 100 240t240 100Z"
    />
  );
}

export function RepeatIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M280-80 120-240l160-160 42 44-86 86h464v-160h60v220H236l86 86-42 44Zm-80-450v-220h524l-86-86 42-44 160 160-160 160-42-44 86-86H260v160h-60Z"
    />
  );
}

export function LocationIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M529.5-510.5Q550-531 550-560t-20.5-49.5Q509-630 480-630t-49.5 20.5Q410-589 410-560t20.5 49.5Q451-490 480-490t49.5-20.5ZM480-159q133-121 196.5-219.5T740-552q0-118-75.5-193T480-820q-109 0-184.5 75T220-552q0 75 65 173.5T480-159Zm0 79Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z"
    />
  );
}

export function ChatBubbleIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z"
    />
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M140-160q-24 0-42-18.5T80-220v-520q0-23 18-41.5t42-18.5h281l60 60h339q23 0 41.5 18.5T880-680v460q0 23-18.5 41.5T820-160H140Zm0-60h680v-460H456l-60-60H140v520Zm0 0v-520 520Z"
    />
  );
}

const STAR_PATH_FILLED =
  "m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z";
const STAR_PATH_OUTLINE =
  "m323-245 157-94 157 95-42-178 138-120-182-16-71-168-71 167-182 16 138 120-42 178Zm-90 125 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-355Z";

export function StarIcon({
  filled,
  ...props
}: IconProps & { filled: boolean }) {
  return <Icon {...props} path={filled ? STAR_PATH_FILLED : STAR_PATH_OUTLINE} />;
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M796-121 533-384q-30 26-70 40.5T378-329q-108 0-183-75t-75-181q0-106 75-181t182-75q106 0 180.5 75T632-585q0 43-14 83t-42 75l264 262-44 44ZM377-389q81 0 138-57.5T572-585q0-81-57-138.5T377-781q-82 0-139.5 57.5T180-585q0 81 57.5 138.5T377-389Z"
    />
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M220-80q-24.75 0-42.37-17.63Q160-115.25 160-140v-434q0-24.75 17.63-42.38Q195.25-634 220-634h70v-96q0-78.85 55.61-134.42Q401.21-920 480.11-920q78.89 0 134.39 55.58Q670-808.85 670-730v96h70q24.75 0 42.38 17.62Q800-598.75 800-574v434q0 24.75-17.62 42.37Q764.75-80 740-80H220Zm0-60h520v-434H220v434Zm314.5-162.03Q557-324.06 557-355q0-30-22.67-54.5t-54.5-24.5q-31.83 0-54.33 24.5t-22.5 55q0 30.5 22.67 52.5t54.5 22q31.83 0 54.33-22.03ZM350-634h260v-96q0-54.17-37.88-92.08-37.88-37.92-92-37.92T388-822.08q-38 37.91-38 92.08v96ZM220-140v-434 434Z"
    />
  );
}

export function DescriptionIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M319-250h322v-60H319v60Zm0-170h322v-60H319v60ZM220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h361l219 219v521q0 24-18 42t-42 18H220Zm331-554v-186H220v680h520v-494H551ZM220-820v186-186 680-680Z"
    />
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M180-180h44l472-471-44-44-472 471v44Zm-60 60v-128l575-574q8-8 19-12.5t23-4.5q11 0 22 4.5t20 12.5l44 44q9 9 13 20t4 22q0 11-4.5 22.5T823-694L248-120H120Zm659-617-41-41 41 41Zm-105 64-22-22 44 44-22-22Z"
    />
  );
}

export function ArrowUpwardIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M450-160v-526L202-438l-42-42 320-320 320 320-42 42-248-248v526h-60Z"
    />
  );
}

export function OpenInNewIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h279v60H180v600h600v-279h60v279q0 24-18 42t-42 18H180Zm202-219-42-43 398-398H519v-60h321v321h-60v-218L382-339Z"
    />
  );
}

export function AttachFileIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M728-326q0 103-72.18 174.5-72.17 71.5-175 71.5Q378-80 305.5-151.5T233-326v-380q0-72.5 51.5-123.25T408-880q72 0 123.5 50.75T583-706v360q0 42-30 72t-72.5 30q-42.5 0-72.5-29.67-30-29.68-30-72.33v-370h60v370q0 17 12.5 29.5t30.64 12.5q18.14 0 30-12.5T523-346v-360q0-48-33.5-81t-81.71-33q-48.21 0-81.5 33.06T293-706v380q0 78 54.97 132T481-140q77.92 0 132.46-54Q668-248 668-326v-390h60v390Z"
    />
  );
}

export function ArrowForwardIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M686-450H160v-60h526L438-758l42-42 320 320-320 320-42-42 248-248Z"
    />
  );
}

export function ViewListIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M350-220h470v-137H350v137ZM140-603h150v-137H140v137Zm0 187h150v-127H140v127Zm0 196h150v-137H140v137Zm210-196h470v-127H350v127Zm0-187h470v-137H350v137ZM140-160q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H140Z"
    />
  );
}

export function ViewKanbanIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M279-277h60v-406h-60v406Zm342-80h60v-326h-60v326ZM450-477h60v-206h-60v206ZM180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h600q24 0 42 18t18 42v600q0 24-18 42t-42 18H180Zm0-60h600v-600H180v600Zm0-600v600-600Z"
    />
  );
}

export function CalendarMonthIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M180-80q-24 0-42-18t-18-42v-620q0-24 18-42t42-18h65v-60h65v60h340v-60h65v60h65q24 0 42 18t18 42v620q0 24-18 42t-42 18H180Zm0-60h600v-430H180v430Zm0-490h600v-130H180v130Zm0 0v-130 130Zm300 230q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-188.5-11.5Q280-423 280-440t11.5-28.5Q303-480 320-480t28.5 11.5Q360-457 360-440t-11.5 28.5Q337-400 320-400t-28.5-11.5ZM640-400q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-188.5-11.5Q280-263 280-280t11.5-28.5Q303-320 320-320t28.5 11.5Q360-297 360-280t-11.5 28.5Q337-240 320-240t-28.5-11.5ZM640-240q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"
    />
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M378-246 154-470l43-43 181 181 384-384 43 43-427 427Z"
    />
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M120-240v-60h720v60H120Zm0-210v-60h720v60H120Zm0-210v-60h720v60H120Z"
    />
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z"
    />
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M561-240 320-481l241-241 43 43-198 198 198 198-43 43Z"
    />
  );
}

export function AddIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      path="M450-450H200v-60h250v-250h60v250h250v60H510v250h-60v-250Z"
    />
  );
}
