import Svg, { Circle, Line, Path } from 'react-native-svg';

export type IconProps = { size?: number; color?: string; strokeWidth?: number };

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
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path d="M7 4.6 H17 V20.2 L12 16.4 L7 20.2 Z" {...sp(p)} />
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
  return (
    <Svg viewBox="0 0 24 24" width={p.size ?? 22} height={p.size ?? 22}>
      <Path
        d="M12 19.6 C7.2 15.8 4.8 13 4.8 10.2 A3.7 3.7 0 0 1 12 8.3 A3.7 3.7 0 0 1 19.2 10.2 C19.2 13 16.8 15.8 12 19.6 Z"
        {...sp(p)}
      />
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
