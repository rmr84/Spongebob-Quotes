import { avatarSrc, type AvatarRef } from '../lib/profile';

interface Props {
  uid: string;
  name: string;
  avatar?: AvatarRef | null;
  size?: number;
  className?: string;
}

/** A player's profile picture, or the first letter of their name if they haven't chosen one. */
export function PlayerAvatar({ uid, name, avatar, size = 32, className = '' }: Props) {
  const src = avatarSrc(uid, avatar);
  return (
    <span className={`player-avatar ${className}`} style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- small, already-sized thumbnails
        <img src={src} alt="" draggable={false} />
      ) : (
        <span aria-hidden="true">{name.trim()[0]?.toUpperCase() ?? '?'}</span>
      )}
    </span>
  );
}
