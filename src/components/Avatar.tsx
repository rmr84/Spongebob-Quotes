import type { Character } from '../data/characters';

/** A character's portrait in a colored circle, falling back to their emoji. */
export function Avatar({ character, big }: { character: Character; big?: boolean }) {
  return (
    <span className={`chip${big ? ' big' : ''}${character.image ? ' has-image' : ''}`} style={{ background: character.color }}>
      {character.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static thumbnails; next/image adds nothing here
        <img src={character.image} alt="" style={{
            objectPosition: character.imagePos,
            transform:
              [character.imageShift && `translate(${character.imageShift})`, character.imageZoom && `scale(${character.imageZoom})`]
                .filter(Boolean)
                .join(' ') || undefined,
            transformOrigin: character.imagePos,
          }} loading="lazy" draggable={false} />
      ) : (
        character.emoji
      )}
    </span>
  );
}
