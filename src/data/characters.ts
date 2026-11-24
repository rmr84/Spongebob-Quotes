// Character roster. The ids must match scripts/speakers.json.
// Each guess is compared against the answer on these attributes.

export interface Character {
  id: string;
  name: string;
  species: string;
  gender: 'Male' | 'Female' | 'None';
  home: string;
  job: string;
  /** Accent color for the character chip. */
  color: string;
  emoji: string;
  /** Portrait in /public/characters; the emoji is shown when there isn't one. */
  image?: string;
  /** CSS object-position used when cropping the portrait to a circle. */
  imagePos?: string;
  /** Zoom toward imagePos, for full-body pictures where the face is small. */
  imageZoom?: number;
  /** Nudge the picture inside its circle, as a CSS translate (e.g. '0, 15%' moves it down). */
  imageShift?: string;
}

export const CHARACTERS: Character[] = [
  { id: 'spongebob', name: 'SpongeBob SquarePants', species: 'Sea sponge', gender: 'Male', home: 'Pineapple', job: 'Fry cook', color: '#f7d433', emoji: '🧽', image: '/characters/spongebob.jpg' },
  { id: 'patrick', name: 'Patrick Star', species: 'Starfish', gender: 'Male', home: 'Rock', job: 'Unemployed', color: '#f79ab5', emoji: '⭐', image: '/characters/patrick.jpg' },
  { id: 'squidward', name: 'Squidward Tentacles', species: 'Octopus', gender: 'Male', home: 'Easter Island head', job: 'Cashier', color: '#9fc9c1', emoji: '🐙', image: '/characters/squidward.jpg', imagePos: '50% 38%', imageZoom: 1.3 },
  { id: 'krabs', name: 'Mr. Krabs', species: 'Crab', gender: 'Male', home: 'Anchor', job: 'Restaurant owner', color: '#e84a3c', emoji: '🦀', image: '/characters/krabs.jpg' },
  { id: 'sandy', name: 'Sandy Cheeks', species: 'Squirrel', gender: 'Female', home: 'Treedome', job: 'Scientist', color: '#b57a45', emoji: '🐿️', image: '/characters/sandy.jpg' },
  { id: 'plankton', name: 'Plankton', species: 'Plankton', gender: 'Male', home: 'Chum Bucket', job: 'Restaurant owner', color: '#3f9a4a', emoji: '🦠', image: '/characters/plankton.jpg' },
  { id: 'karen', name: 'Karen', species: 'Computer', gender: 'Female', home: 'Chum Bucket', job: 'Assistant', color: '#5f8fc9', emoji: '🖥️', image: '/characters/karen.jpg', imagePos: '50% 50%' },
  { id: 'puff', name: 'Mrs. Puff', species: 'Pufferfish', gender: 'Female', home: 'Bikini Bottom', job: 'Teacher', color: '#e9b36b', emoji: '🐡', image: '/characters/puff.png' },
  { id: 'pearl', name: 'Pearl Krabs', species: 'Whale', gender: 'Female', home: 'Anchor', job: 'Student', color: '#c9cdd6', emoji: '🐋', image: '/characters/pearl.jpg' },
  { id: 'mermaidman', name: 'Mermaid Man', species: 'Fish', gender: 'Male', home: 'Shady Shoals', job: 'Superhero', color: '#e8733c', emoji: '🦸', image: '/characters/mermaidman.jpg', imagePos: '50% 30%' },
  { id: 'barnacleboy', name: 'Barnacle Boy', species: 'Fish', gender: 'Male', home: 'Shady Shoals', job: 'Superhero', color: '#3c6be8', emoji: '⚓', image: '/characters/barnacleboy.jpg' },
  { id: 'larry', name: 'Larry the Lobster', species: 'Lobster', gender: 'Male', home: 'Goo Lagoon', job: 'Lifeguard', color: '#d6402f', emoji: '🦞', image: '/characters/larry.jpg', imagePos: '45% 12%', imageZoom: 1.35 },
  { id: 'squilliam', name: 'Squilliam Fancyson', species: 'Octopus', gender: 'Male', home: 'Mansion', job: 'Socialite', color: '#8ab0a9', emoji: '🎩', image: '/characters/squilliam.jpg' },
  { id: 'dutchman', name: 'The Flying Dutchman', species: 'Ghost', gender: 'Male', home: 'Ghost ship', job: 'Pirate', color: '#7fd18b', emoji: '👻', image: '/characters/dutchman.png', imagePos: '45% 32%', imageZoom: 1.4 },
  { id: 'narrator', name: 'The French Narrator', species: 'Human', gender: 'Male', home: 'Unknown', job: 'Narrator', color: '#a28bd4', emoji: '🎙️', image: '/characters/narrator.jpg', imagePos: '50% 52%', imageZoom: 1.05 },
  { id: 'patchy', name: 'Patchy the Pirate', species: 'Human', gender: 'Male', home: 'Surface world', job: 'Pirate', color: '#6b4f3a', emoji: '🏴‍☠️', image: '/characters/patchy.jpg', imagePos: '57% 40%', imageZoom: 1.6 },
  { id: 'potty', name: 'Potty the Parrot', species: 'Parrot', gender: 'Male', home: 'Surface world', job: 'Pirate', color: '#4fbf5a', emoji: '🦜', image: '/characters/potty.jpg', imagePos: '58% 38%', imageZoom: 1.8 },
  { id: 'bubblebass', name: 'Bubble Bass', species: 'Fish', gender: 'Male', home: 'Bikini Bottom', job: 'Customer', color: '#6fa86a', emoji: '🥒', image: '/characters/bubblebass.jpg', imagePos: '52% 2%', imageZoom: 1.45 },
  { id: 'neptune', name: 'King Neptune', species: 'Merman', gender: 'Male', home: 'Atlantis', job: 'Royalty', color: '#e0b341', emoji: '🔱', image: '/characters/neptune.jpg', imagePos: '58% 12%', imageZoom: 1.6 },
  { id: 'manray', name: 'Man Ray', species: 'Manta ray', gender: 'Male', home: 'Villain lair', job: 'Supervillain', color: '#c7372f', emoji: '🦹', image: '/characters/manray.jpg', imagePos: '54% 38%', imageZoom: 1.25 },
  { id: 'dirtybubble', name: 'Dirty Bubble', species: 'Bubble', gender: 'Male', home: 'Villain lair', job: 'Supervillain', color: '#8f8a5a', emoji: '🫧', image: '/characters/dirtybubble.jpg', imagePos: '55% 50%', imageZoom: 1.45 },
  { id: 'perch', name: 'Perch Perkins', species: 'Fish', gender: 'Male', home: 'Bikini Bottom', job: 'News reporter', color: '#d18b4f', emoji: '📺', image: '/characters/perch.png', imagePos: '58% 12%', imageZoom: 1.55 },
  { id: 'jenkins', name: 'Old Man Jenkins', species: 'Fish', gender: 'Male', home: 'Bikini Bottom', job: 'Retiree', color: '#b0a48f', emoji: '👴', image: '/characters/jenkins.png' },
  { id: 'conch', name: 'The Magic Conch', species: 'Shell', gender: 'None', home: 'Kelp Forest', job: 'Oracle', color: '#f2b8c6', emoji: '🐚', image: '/characters/conch.jpg' },
  { id: 'kevin', name: 'Kevin C. Cucumber', species: 'Sea cucumber', gender: 'Male', home: 'Bikini Bottom', job: 'Jellyfisher', color: '#7aa35a', emoji: '🪼', image: '/characters/kevin.jpg', imagePos: '50% 42%', imageZoom: 1.5 },
];

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));
