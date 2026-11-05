// Prompts by mode. There is no "correct" answer — the group's majority IS the answer.
// Keep each prompt about the people in the room.

export const MODES = ['chill', 'roast', 'spicy', 'chaos'];

// Modes that require every phone to opt in before the room can start.
export const CONSENT_MODES = ['spicy', 'chaos'];

const PROMPTS = {
  chill: [
    "Who here would survive longest on a desert island?",
    "Who's most likely to become famous?",
    "Who gives the best advice?",
    "Who would win in a fight against a goose?",
    "Who's the most likely to cry at a movie?",
    "Who would make the best president?",
    "Who's secretly the smartest in the room?",
    "Who would you trust with your phone unlocked?",
    "Who's most likely to adopt five dogs?",
    "Who here could talk their way out of anything?",
    "Who would forget their own birthday?",
    "Who's the best cook in the room?",
    "Who would survive a zombie apocalypse the longest?",
    "Who's most likely to start a successful business?",
    "Who gives the worst directions?",
  ],
  roast: [
    "Who's most likely to text their ex tonight?",
    "Who peaked in high school?",
    "Who's the worst driver here?",
    "Who takes the longest to reply to a text?",
    "Who's most likely to get kicked out of a bar?",
    "Who's the biggest liar in the room?",
    "Who would sell out the group first?",
    "Who's most likely to ghost someone?",
    "Who has the worst taste in music?",
    "Who's faking it the hardest right now?",
    "Who's most likely to cause the group chat drama?",
    "Who's the cheapest person here?",
    "Who would lose a fight to a toddler?",
    "Who's most likely to get catfished?",
    "Who thinks they're funnier than they are?",
  ],
  spicy: [
    "Who here has a crush on someone in this room?",
    "Who's most likely to leave with someone tonight?",
    "Who's the best kisser in the room (guess)?",
    "Who has the wildest story they haven't told?",
    "Who's most likely to send a risky text?",
    "Who would you least expect to be freaky?",
    "Who's most likely to hook up with an ex again?",
    "Who here has thought about someone in this room?",
    "Who gives off the most chaotic dating-app energy?",
    "Who's most likely to kiss a stranger tonight?",
    "Who's the biggest flirt in the room?",
    "Who would survive one week of everyone reading their DMs?",
  ],
};

// Premium prompt packs — the monetization unit. A room's deck is its mode's
// prompts plus any packs the host has unlocked and enabled. Prompts here are a
// starter set; expand per pack before launch.
export const PACKS = [
  {
    id: 'college', name: 'College', emoji: '🎓', price: 3,
    blurb: 'Dorms, exes, questionable decisions.',
    prompts: [
      "Who's most likely to still be going out at 35?",
      "Who failed a class they never told anyone about?",
      "Who's most likely to have hooked up in the library?",
      "Who peaked at a house party?",
      "Who would survive finals week on zero sleep?",
      "Who's most likely to have texted a professor something unhinged?",
      "Who had the most chaotic roommate story?",
      "Who's most likely to still owe someone money from college?",
    ],
  },
  {
    id: 'couples', name: 'Couples', emoji: '💘', price: 3,
    blurb: 'For double dates and group dinners.',
    prompts: [
      "Which couple here fights the most in private?",
      "Who wears the pants in their relationship?",
      "Who's most likely to propose first?",
      "Which couple started as a situationship?",
      "Who's the bigger romantic of their pair?",
      "Who's most likely to forget an anniversary?",
      "Which couple overshares the most?",
      "Who would survive longest single if they broke up?",
    ],
  },
  {
    id: 'bachelorette', name: 'Bachelorette', emoji: '👰', price: 4,
    blurb: 'Last night of freedom energy.',
    prompts: [
      "Who's going to cry first tonight?",
      "Who's most likely to lose their phone before midnight?",
      "Who's the designated chaos agent of the group?",
      "Who's most likely to flirt with the bartender?",
      "Who gave the bride the worst advice?",
      "Who's most likely to start the afterparty?",
      "Who will remember the least tomorrow?",
      "Who's secretly planning to catch the bouquet?",
    ],
  },
];

export function packById(id) {
  return PACKS.find((p) => p.id === id) || null;
}

// Wildcard rules that can flip a round. Each has an id, label, and how it scores.
export const WILDCARDS = [
  { id: 'minority', label: 'MINORITY WINS: the least-picked person is in the hot seat.' },
  { id: 'double', label: 'DOUBLE TROUBLE: everyone who guesses wrong takes double.' },
  { id: 'reverse', label: 'REVERSE: a wrong prediction is the safe one this round.' },
];

// Challenges handed out instead of (or on top of) a sip. No repeats within a game.
// Mix of drinks, dares and chaos. There's always a non-drinking option.
export const CHALLENGES = [
  "Take a sip.",
  "Give two sips to anyone.",
  "Everyone to your left drinks.",
  "Last to raise a hand takes two.",
  "Waterfall: start drinking, no one stops until you do.",
  "Do your best impression of the person in the hot seat.",
  "Give a genuine compliment to the hot seat, then take a sip anyway.",
  "Swap seats with the person in the hot seat.",
  "Do 10 squats while naming your exes out loud.",
  "Show the group your last Google search. No scrolling away.",
  "Reveal your phone's screen-time number to the room.",
  "Speak only in the third person until the next reveal.",
  "Whisper everything you say for the next two rounds.",
  "The group gives you a new name for the night. Only answer to it.",
  "Hold eye contact with the hot seat for 30 seconds. Laugh and you drink.",
  "Let the person on your right type one text from your phone to anyone.",
  "Keep one hand on your head until someone else lands in the hot seat.",
  "Do your worst accent until your next turn. Drop it and you drink.",
  "Serenade the person across from you for 15 seconds.",
  "Dramatically re-enact how you think you'll die.",
  "Let the hot seat pick an emoji that replaces every time you say 'the'.",
  "Read your most recent text out loud, sender included.",
  "Call the 5th contact in your phone and tell them a weird fun fact.",
  "Swap one visible item of clothing with the person on your left.",
  "Propose to the nearest stranger or inanimate object. Mean it.",
  "Everyone votes one word you're banned from saying all night. Slip up, drink.",
  "Narrate everyone else's actions like a nature documentary until your next turn.",
  "Let the group choose a dare emoji; the hot seat decides what it means.",
];

export function promptsForMode(mode) {
  if (mode === 'chaos') {
    // Everything mixed.
    return [...PROMPTS.chill, ...PROMPTS.roast, ...PROMPTS.spicy];
  }
  return PROMPTS[mode] ?? PROMPTS.chill;
}

export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
