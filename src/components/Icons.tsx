import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconProps = { size?: number; color?: string; strokeWidth?: number; filled?: boolean };

function sp(p: IconProps) {
  return {
    stroke: p.color ?? '#000',
    strokeWidth: p.strokeWidth ?? 1.8,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M3.8 11.3 L12 4.2 L20.2 11.3" {...sp(p)} />
      <Path d="M6 9.8 V20 H18 V9.8" {...sp(p)} />
      <Path d="M10.2 20 V14.4 H13.8 V20" {...sp(p)} />
    </Svg>
  );
}

export function BookIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path
        d="M12 6.6 C10 4.9 7.2 4.6 4 5.1 V18.6 C7.2 18.1 10 18.4 12 20.1 C14 18.4 16.8 18.1 20 18.6 V5.1 C16.8 4.6 14 4.9 12 6.6 Z"
        {...sp(p)}
      />
      <Path d="M12 6.6 V20.1" {...sp(p)} />
    </Svg>
  );
}

export function MosqueIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M5.2 20 V13.2 C5.2 9.8 8 8.2 12 5.4 C16 8.2 18.8 9.8 18.8 13.2 V20" {...sp(p)} />
      <Path d="M3 20 H21" {...sp(p)} />
      <Path d="M10.4 20 V16.2 C10.4 14.9 13.6 14.9 13.6 16.2 V20" {...sp(p)} />
      <Path d="M12 5.4 V3.6" {...sp(p)} />
      <Circle cx={12} cy={2.7} r={0.9} fill={p.color ?? '#000'} stroke="none" />
    </Svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={9} cy={8} r={3} {...sp(p)} />
      <Circle cx={16.6} cy={8.6} r={2.3} {...sp(p)} />
      <Path d="M4 19.4 C4 16.2 6.3 14.8 9 14.8 C11.7 14.8 14 16.2 14 19.4" {...sp(p)} />
      <Path d="M15.4 15 C18 15 20.2 16.6 20.2 19.4" {...sp(p)} />
    </Svg>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={8.2} r={3.8} {...sp(p)} />
      <Path d="M5.2 20 C5.2 16.4 8.2 14.8 12 14.8 C15.8 14.8 18.8 16.4 18.8 20" {...sp(p)} />
    </Svg>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M6.2 16 V11 C6.2 7.6 8.7 5.6 12 5.6 C15.3 5.6 17.8 7.6 17.8 11 V16 L19.4 18.2 H4.6 Z" {...sp(p)} />
      <Path d="M10 18.2 a2 2 0 0 0 4 0" {...sp(p)} />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={10.5} cy={10.5} r={6.2} {...sp(p)} />
      <Path d="M15.3 15.3 L20 20" {...sp(p)} />
    </Svg>
  );
}

export function FilterIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4 6 H20 L14.2 12.6 V18.8 L11.8 20 V12.6 Z" {...sp(p)} />
    </Svg>
  );
}

export function ShareIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={6} cy={12} r={2.3} {...sp(p)} />
      <Circle cx={18} cy={5.8} r={2.3} {...sp(p)} />
      <Circle cx={18} cy={18.2} r={2.3} {...sp(p)} />
      <Path d="M8.1 10.9 L15.9 6.9 M8.1 13.1 L15.9 17.1" {...sp(p)} />
    </Svg>
  );
}

export function BookmarkIcon(p: IconProps) {
  const s = sp(p);
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path
        d="M7 4.6 H17 V20.2 L12 16.4 L7 20.2 Z"
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        fill={p.filled ? s.stroke : 'none'}
        strokeLinecap={s.strokeLinecap}
        strokeLinejoin={s.strokeLinejoin}
      />
    </Svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M9.6 5.6 L16 12 L9.6 18.4" {...sp(p)} />
    </Svg>
  );
}

export function EyeIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path
        d="M2.8 12 C5.2 7.8 8.2 5.8 12 5.8 C15.8 5.8 18.8 7.8 21.2 12 C18.8 16.2 15.8 18.2 12 18.2 C8.2 18.2 5.2 16.2 2.8 12 Z"
        {...sp(p)}
      />
      <Circle cx={12} cy={12} r={2.6} {...sp(p)} />
    </Svg>
  );
}

export function EyeOffIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path
        d="M4 4.5 C7.6 4.6 10.3 5.9 12 8.4 C13.7 10.9 15.4 14 17 16.5 M20.2 12 C18.8 14.7 16 17.4 12 17.4 C10.2 17.4 8.5 16.8 7 15.6 M4.6 17.6 C3.9 16.5 3.2 15.2 2.8 14 C4 11.9 5.6 9.9 7.6 8.6"
        {...sp(p)}
      />
      <Path d="M4.5 4.5 L19.5 19.5" {...sp(p)} />
    </Svg>
  );
}

export function MailIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M3.6 6 H20.4 V18 H3.6 Z" {...sp(p)} />
      <Path d="M4.2 6.8 L12 13 L19.8 6.8" {...sp(p)} />
    </Svg>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M7 10.6 H17 V19.8 H7 Z" {...sp(p)} />
      <Path d="M9.2 10.6 V8.2 A2.8 2.8 0 0 1 14.8 8.2 V10.6" {...sp(p)} />
    </Svg>
  );
}

export function FlameIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 3.2 C12.8 6 16.2 7.6 16.2 11.4 A4.2 4.2 0 0 1 7.8 11.6 C7.8 9.4 9.2 8.4 9.8 6.4 C10.8 7.8 12 7.6 12 3.2 Z" {...sp(p)} />
    </Svg>
  );
}

export function TargetIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={12} r={7.6} {...sp(p)} />
      <Circle cx={12} cy={12} r={3.8} {...sp(p)} />
      <Circle cx={12} cy={12} r={0.9} fill={p.color ?? '#000'} stroke="none" />
    </Svg>
  );
}

export function MedalIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M8.2 3.6 H15.8 L17.8 7.8 L12 12 L6.2 7.8 Z" {...sp(p)} />
      <Path d="M12 12 V14.4" {...sp(p)} />
      <Path d="M9.4 20.4 A4.4 4.4 0 0 0 14.6 20.4 L13.8 14.6 H10.2 Z" {...sp(p)} />
    </Svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M5 12.6 L10 17.6 L19 7.2" {...sp(p)} />
    </Svg>
  );
}

export function CheckCircleIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={12} r={8.6} {...sp(p)} />
      <Path d="M8.4 12.4 L11 15 L15.8 9.4" {...sp(p)} />
    </Svg>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={12} r={3.2} {...sp(p)} />
      <Path
        d="M12 3.4 V5.6 M12 18.4 V20.6 M3.4 12 H5.6 M18.4 12 H20.6 M5.9 5.9 L7.4 7.4 M16.6 16.6 L18.1 18.1 M18.1 5.9 L16.6 7.4 M7.4 16.6 L5.9 18.1"
        {...sp(p)}
      />
    </Svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4.6 6.4 H19.4 V20 H4.6 Z" {...sp(p)} />
      <Path d="M4.6 10.6 H19.4" {...sp(p)} />
      <Path d="M8.2 4.2 V7.4 M15.8 4.2 V7.4" {...sp(p)} />
    </Svg>
  );
}

export function BeadsIcon(p: IconProps) {
  const beads = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    beads.push(
      <Circle
        key={k}
        cx={12 + 6.4 * Math.cos(a)}
        cy={11.4 + 6.4 * Math.sin(a)}
        r={1.5}
        stroke={p.color ?? '#000'}
        strokeWidth={p.strokeWidth ?? 1.6}
        fill="none"
      />,
    );
  }
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      {beads}
      <Path d="M12 17.8 V20.8" {...sp(p)} />
    </Svg>
  );
}

export function HeartIcon(p: IconProps) {
  const s = sp(p);
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path
        d="M12 19.6 C7.2 15.8 4.8 13 4.8 10.2 A3.7 3.7 0 0 1 12 8.3 A3.7 3.7 0 0 1 19.2 10.2 C19.2 13 16.8 15.8 12 19.6 Z"
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        fill={p.filled ? s.stroke : 'none'}
        strokeLinecap={s.strokeLinecap}
        strokeLinejoin={s.strokeLinejoin}
      />
    </Svg>
  );
}

export function ChatIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4 5.6 H20 V15.6 H12 L7.6 19 V15.6 H4 Z" {...sp(p)} />
      <Line x1="8" y1="9.6" x2="16" y2="9.6" {...sp(p)} />
      <Line x1="8" y1="12.6" x2="13" y2="12.6" {...sp(p)} />
    </Svg>
  );
}

export function FlagIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M6 21 V4" {...sp(p)} />
      <Path d="M6 5 H18 L15.4 8.4 L18 11.8 H6 Z" {...sp(p)} />
    </Svg>
  );
}

export function GraduationCapIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 4 L21.5 8.6 L12 13.2 L2.5 8.6 Z" {...sp(p)} />
      <Path d="M6.5 10.8 V15.4 C6.5 16.9 9 18 12 18 C15 18 17.5 16.9 17.5 15.4 V10.8" {...sp(p)} />
      <Path d="M21.5 8.6 V13.6" {...sp(p)} />
    </Svg>
  );
}

export function LogOutIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M14 4 H6.5 A1.5 1.5 0 0 0 5 5.5 V18.5 A1.5 1.5 0 0 0 6.5 20 H14" {...sp(p)} />
      <Path d="M10.5 12 H20" {...sp(p)} />
      <Path d="M16.8 8.6 L20.2 12 L16.8 15.4" {...sp(p)} />
    </Svg>
  );
}

export function RefreshIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4.6 10.2 A7.6 7.6 0 0 1 18.4 7.2 L20 9" {...sp(p)} />
      <Path d="M20 4.4 V9 H15.4" {...sp(p)} />
      <Path d="M19.4 13.8 A7.6 7.6 0 0 1 5.6 16.8 L4 15" {...sp(p)} />
      <Path d="M4 19.6 V15 H8.6" {...sp(p)} />
    </Svg>
  );
}

export function SunIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx="12" cy="12" r="4.2" {...sp(p)} />
      <Line x1="12" y1="2.6" x2="12" y2="5" {...sp(p)} />
      <Line x1="12" y1="19" x2="12" y2="21.4" {...sp(p)} />
      <Line x1="2.6" y1="12" x2="5" y2="12" {...sp(p)} />
      <Line x1="19" y1="12" x2="21.4" y2="12" {...sp(p)} />
      <Line x1="5.4" y1="5.4" x2="7.1" y2="7.1" {...sp(p)} />
      <Line x1="16.9" y1="16.9" x2="18.6" y2="18.6" {...sp(p)} />
      <Line x1="18.6" y1="5.4" x2="16.9" y2="7.1" {...sp(p)} />
      <Line x1="7.1" y1="16.9" x2="5.4" y2="18.6" {...sp(p)} />
    </Svg>
  );
}

export function CalculatorIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Rect x="5" y="3.4" width="14" height="17.2" rx="2.4" {...sp(p)} />
      <Line x1="8.2" y1="7.4" x2="15.8" y2="7.4" {...sp(p)} />
      <Line x1="9.2" y1="12" x2="9.2" y2="12.01" {...sp(p)} />
      <Line x1="12" y1="12" x2="12" y2="12.01" {...sp(p)} />
      <Line x1="14.8" y1="12" x2="14.8" y2="12.01" {...sp(p)} />
      <Line x1="9.2" y1="15.6" x2="9.2" y2="15.61" {...sp(p)} />
      <Line x1="12" y1="15.6" x2="12" y2="15.61" {...sp(p)} />
      <Line x1="14.8" y1="15.6" x2="14.8" y2="17.4" {...sp(p)} />
    </Svg>
  );
}

export function PaperPlaneIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M21 3.5 L3 10.6 L10 13.5 L13 20.8 Z" {...sp(p)} />
      <Path d="M21 3.5 L10 13.5" {...sp(p)} />
    </Svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Line x1="6" y1="6" x2="18" y2="18" {...sp(p)} />
      <Line x1="18" y1="6" x2="6" y2="18" {...sp(p)} />
    </Svg>
  );
}

export function StarIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 3.6 L14.5 9.1 L20.4 9.8 L16 13.8 L17.2 19.6 L12 16.6 L6.8 19.6 L8 13.8 L3.6 9.8 L9.5 9.1 Z" {...sp(p)} />
    </Svg>
  );
}

export function BagIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M5.5 8 H18.5 L17.4 20 H6.6 Z" {...sp(p)} />
      <Path d="M8.6 10.4 V6.2 A3.4 3.4 0 0 1 15.4 6.2 V10.4" {...sp(p)} />
    </Svg>
  );
}

export function PrayingHandsIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 3.4 L8.2 9.4 C7.1 11.2 7.3 13.4 8.4 15.2 L10.6 19 H13.4 L15.6 15.2 C16.7 13.4 16.9 11.2 15.8 9.4 Z" {...sp(p)} />
      <Path d="M12 6.5 V19" {...sp(p)} />
      <Path d="M8.4 15.2 C7.4 13.5 7.3 11.4 8.2 9.6" {...sp(p)} />
      <Path d="M15.6 15.2 C16.6 13.5 16.7 11.4 15.8 9.6" {...sp(p)} />
      <Path d="M6.4 20.6 H17.6" {...sp(p)} />
    </Svg>
  );
}

export function StarCrescentIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M15.5 3.2 A9 9 0 1 0 15.5 20.8 A7.4 7.4 0 1 1 15.5 3.2 Z" {...sp(p)} />
      <Path d="M16.9 8.6 L17.9 11.2 L20.6 11.3 L18.5 12.9 L19.2 15.5 L17 14 L14.8 15.5 L15.5 12.9 L13.4 11.3 L16.1 11.2 Z" {...sp(p)} />
    </Svg>
  );
}

export function BrainIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 4.5 C10.8 3 8.6 2.8 7.2 3.9 C5.6 5 5.2 6.9 6 8.4 C4.8 9.1 4.2 10.6 4.8 12 C4 13.4 4.5 15.2 6 16 C6.2 17.9 8 19.3 9.9 19 C10.6 19.8 11.6 20 12 20 C12.4 20 13.4 19.8 14.1 19 C16 19.3 17.8 17.9 18 16 C19.5 15.2 20 13.4 19.2 12 C19.8 10.6 19.2 9.1 18 8.4 C18.8 6.9 18.4 5 16.8 3.9 C15.4 2.8 13.2 3 12 4.5 Z" {...sp(p)} />
      <Path d="M12 4.5 V20" {...sp(p)} />
      <Path d="M8.4 8.6 C9.4 9.2 9.8 10.2 9.4 11.2" {...sp(p)} />
      <Path d="M15.6 8.6 C14.6 9.2 14.2 10.2 14.6 11.2" {...sp(p)} />
    </Svg>
  );
}

export function GiftIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4 8.6 H20 V12 H4 Z" {...sp(p)} />
      <Path d="M5.5 12 V19.4 H18.5 V12" {...sp(p)} />
      <Path d="M12 8.6 V19.4" {...sp(p)} />
      <Path d="M12 8.6 C9.6 8.6 7.9 7.6 7.9 6.3 C7.9 5.2 8.9 4.5 10 4.5 C11.2 4.5 12 5.6 12 8.6 C12 5.6 12.8 4.5 14 4.5 C15.1 4.5 16.1 5.2 16.1 6.3 C16.1 7.6 14.4 8.6 12 8.6 Z" {...sp(p)} />
    </Svg>
  );
}

export function ScrollIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M7.2 4.8 H16.8 C18 4.8 19 5.8 19 7 V17 C19 18.2 18 19.2 16.8 19.2 H7.2 C6 19.2 5 18.2 5 17 V14.6" {...sp(p)} />
      <Path d="M7.2 4.8 C6 4.8 5 5.8 5 7 V9.4" {...sp(p)} />
      <Path d="M9 9.6 H15 M9 12.6 H15 M9 15.6 H12.6" {...sp(p)} />
    </Svg>
  );
}

export function PinIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 21 C8.2 16.6 6 13.6 6 10.6 A6 6 0 0 1 18 10.6 C18 13.6 15.8 16.6 12 21 Z" {...sp(p)} />
      <Circle cx={12} cy={10.6} r={2.1} {...sp(p)} />
    </Svg>
  );
}

export function DownloadIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 3.8 V14.4 M8 10.6 L12 14.6 L16 10.6" {...sp(p)} />
      <Path d="M4.8 19.6 H19.2" {...sp(p)} />
    </Svg>
  );
}

export function HelpIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={12} r={8.6} {...sp(p)} />
      <Path d="M9.6 9.6 A2.5 2.5 0 1 1 12.4 12.6 V13.8" {...sp(p)} />
      <Circle cx={12} cy={16.6} r={0.9} fill={p.color ?? '#000'} stroke="none" />
    </Svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={12} r={8.6} {...sp(p)} />
      <Path d="M12 11 V16.2" {...sp(p)} />
      <Circle cx={12} cy={8} r={0.9} fill={p.color ?? '#000'} stroke="none" />
    </Svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 5 V19 M5 12 H19" {...sp(p)} />
    </Svg>
  );
}

export function PlayIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M8.4 5.6 L18 12 L8.4 18.4 Z" {...sp(p)} />
    </Svg>
  );
}

export function CompassIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={12} r={8.6} {...sp(p)} />
      <Path d="M15.2 8.8 L13.2 13.2 L8.8 15.2 L10.8 10.8 Z" {...sp(p)} />
    </Svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={12} r={8.6} {...sp(p)} />
      <Path d="M12 7.4 V12 L15 14" {...sp(p)} />
    </Svg>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z" {...sp(p)} />
    </Svg>
  );
}

export function ShieldIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 3.6 L18.6 6.2 V11.6 C18.6 15.8 15.8 18.8 12 20.4 C8.2 18.8 5.4 15.8 5.4 11.6 V6.2 Z" {...sp(p)} />
    </Svg>
  );
}

export function ImageIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4 5.6 H20 V18.4 H4 Z" {...sp(p)} />
      <Circle cx={8.6} cy={9.6} r={1.4} {...sp(p)} />
      <Path d="M4 16 L9.4 11.4 L13 14.6 L16.4 11.6 L20 14.8" {...sp(p)} />
    </Svg>
  );
}

export function MoonStarIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M14.8 3.8 A 8.6 8.6 0 1 0 19.9 15.6 A 7.1 7.1 0 0 1 14.8 3.8 Z" {...sp(p)} />
      <Path d="M17.6 4.6 l0.7 1.6 1.6 0.7 -1.6 0.7 -0.7 1.6 -0.7 -1.6 -1.6 -0.7 1.6 -0.7 Z" {...sp(p)} />
    </Svg>
  );
}

export function BullhornIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4 10 V14 H7 L18 19 V5 L7 10 Z" {...sp(p)} />
      <Path d="M8 14 V17 C8 18.1 8.9 19 10 19 H11 V15.4" {...sp(p)} />
    </Svg>
  );
}

export function KaabaIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4.6 6.6 L12 3.6 L19.4 6.6 V17.6 L12 20.6 L4.6 17.6 Z" {...sp(p)} />
      <Path d="M4.6 6.6 L12 9.6 L19.4 6.6 M12 9.6 V20.6" {...sp(p)} />
      <Path d="M4.6 10.4 L12 13.4 L19.4 10.4" {...sp(p)} />
    </Svg>
  );
}

export function LandmarkIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M3.6 9.2 L12 3.8 L20.4 9.2 Z" {...sp(p)} />
      <Path d="M5.6 11 V16.8 M9.6 11 V16.8 M14.4 11 V16.8 M18.4 11 V16.8" {...sp(p)} />
      <Path d="M3.6 19.4 H20.4 M4.6 16.8 H19.4" {...sp(p)} />
    </Svg>
  );
}

export function SmileIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Circle cx={12} cy={12} r={8.6} {...sp(p)} />
      <Path d="M8.2 14 A4.8 4.8 0 0 0 15.8 14" {...sp(p)} />
      <Circle cx={9} cy={9.8} r={0.9} fill={p.color ?? '#000'} stroke="none" />
      <Circle cx={15} cy={9.8} r={0.9} fill={p.color ?? '#000'} stroke="none" />
    </Svg>
  );
}

export function NewspaperIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M4.2 5.4 H17 V19.4 H6 A1.8 1.8 0 0 1 4.2 17.6 Z" {...sp(p)} />
      <Path d="M17 8.6 H19.8 V15.6 A1.8 1.8 0 0 1 18 17.4 H17" {...sp(p)} />
      <Path d="M7 9 H14 M7 12 H14 M7 15 H11.6" {...sp(p)} />
    </Svg>
  );
}

export function ScaleIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M12 4 V20 M8.4 20.4 H15.6" {...sp(p)} />
      <Path d="M5 7.2 L19 7.2" {...sp(p)} />
      <Path d="M5 7.2 L2.8 12.4 A2.6 2.6 0 0 0 7.2 12.4 Z" {...sp(p)} />
      <Path d="M19 7.2 L16.8 12.4 A2.6 2.6 0 0 0 21.2 12.4 Z" {...sp(p)} />
    </Svg>
  );
}

export function HandHeartIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path
        d="M12 8.6 C10.3 7.1 9.1 6.2 9.1 4.9 C9.1 3.9 9.9 3.2 10.9 3.2 C11.5 3.2 11.9 3.6 12 4 C12.1 3.6 12.5 3.2 13.1 3.2 C14.1 3.2 14.9 3.9 14.9 4.9 C14.9 6.2 13.7 7.1 12 8.6 Z"
        fill={p.color ?? 'currentColor'}
        stroke="none"
      />
      <Path d="M4.8 12.4 H7.4 C8.3 12.4 9 13 9 13.9 C9 14.8 8.3 15.4 7.4 15.4 H10.2 C11.2 15.4 12 15.8 12.8 16.4 L15.6 18.4 C16.2 18.8 16.4 19.6 16 20.2 C15.6 20.8 14.8 21 14.2 20.6 L10.6 18.2" {...sp(p)} />
      <Path d="M9 12.4 V9.8 M11.8 15.4 V13.2 M14.6 18 V14.6" {...sp(p)} />
    </Svg>
  );
}

export function AppleIcon(p: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path
        d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.15-1.69 1.63-3.32 1.66-3.41-.04-.02-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.37-2-.16-3.68 1.09-4.62 1.09zM15.53 3.83c.84-1.01 1.4-2.43 1.24-3.83-1.2.05-2.66.8-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.72-.69 3.56-1.7z"
        fill={p.color ?? 'currentColor'}
      />
    </Svg>
  );
}
