// Prompts by mode. There is no "correct" answer — the group's majority IS the answer.
// Keep each prompt about the people in the room.

export const MODES = ['chill', 'roast', 'spicy', 'chaos', 'duel'];

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
  // --- Drinks: straight ---
  "Take a sip.",
  "Take two sips.",
  "Take a big gulp.",
  "Finish your drink.",
  "Finish your drink if it's less than half full.",
  "Take a drink with your non-dominant hand. Spill and take another.",
  "Take a drink with your eyes closed.",
  "Take as many sips as the current round number (max three).",
  "Finish your drink, or pass it to someone who will.",
  "Take a sip and dedicate it to your worst decision this year.",
  // --- Drinks: hand them out ---
  "Hand out two sips however you like.",
  "Hand out three sips however you like.",
  "Pick someone to drink with you.",
  "Pick two people to each take a sip.",
  "Everyone on your left takes a sip.",
  "Everyone on your right takes a sip.",
  "Pour a splash of your drink into someone else's cup. They finish it.",
  "The person on your right picks who drinks next.",
  "Make everyone to your right take a sip.",
  // --- Drinks: whole room ---
  "Social! Everyone takes a sip with you.",
  "Waterfall: everyone drinks, and no one stops until you do.",
  "Everyone who's single takes a sip.",
  "Everyone in a relationship takes a sip.",
  "Everyone wearing black takes a sip.",
  "Everyone wearing white takes a sip.",
  "Everyone on their phone right now takes a sip.",
  "Everyone younger than you takes a sip.",
  "Everyone older than you takes a sip.",
  "Everyone who has kissed someone in this room takes a sip.",
  "Everyone who's left for the bathroom since the game started drinks.",
  "Toast to someone in the room. Everyone drinks to them.",
  // --- Drinks: mini-games ---
  "The person on your left decides: you take 1, 2, or 3 sips.",
  "Rock paper scissors the person on your left. Loser drinks.",
  "Thumb war the person across from you. Loser drinks.",
  "Arm wrestle the person next to you. Loser takes two sips.",
  "Staring contest with the person across from you. Blink or laugh and you drink.",
  "Flip a coin. Call it wrong and take two sips.",
  "Name five car brands in ten seconds, or take two sips.",
  "Name five pizza toppings in ten seconds, or take two sips.",
  "Say the alphabet backwards. Mess up and take a sip.",
  "Pick a category and go around the room naming things. First to blank takes a sip.",
  "Start a nose goes: touch your nose. Last person to copy you drinks.",
  "Say 'go', then the last person to raise their hand drinks.",
  "Guess who lands in the hot seat next. Wrong and take two sips.",
  // --- Drinks: rules & buddies ---
  "Make a house rule now. Anyone who breaks it drinks, you included.",
  "Pick a drinking buddy. For the rest of the game, when one of you drinks, so does the other.",
  "You're the bartender this round: anyone who drinks, you take one too.",
  "Cheers the person across from you. You both drink.",
  "You and the youngest person here both drink.",
  "Take a sip every time someone says your name until the next reveal.",
  "Take a sip every time you laugh until the next reveal.",
  "Take a sip each time you say 'um' or 'like' until the next reveal.",
  "Sip every time someone swears until the next reveal.",
  "Hold your pinky up until the next reveal. Forget and you drink.",
  "Take a sip, then pick who takes the next challenge.",
  "Never have I ever: say one true thing. Anyone who's done it drinks.",
  "Give out a sip for every ring, watch or bracelet you're wearing.",
  "Take a sip for every sibling you have (max three).",
  // --- Dares: drink-or-do ---
  "Do 10 pushups, or take two sips.",
  "Let the person across from you give you a dare, or take two sips.",
  "Reveal who you last texted, or take two sips.",
  "Tell the group something you've never told them, or take two sips.",
  "Text the last person you texted a single heart emoji, or take two sips.",
  "Let the person on your right post one word to your story, or take two sips.",
  // --- Dares: performance ---
  "Do your best impression of someone else in the room.",
  "Talk in an accent until the next reveal. Drop it and you drink.",
  "Serenade the person across from you for 15 seconds.",
  "Sing your next sentence like it's a musical.",
  "Do your best catwalk to the nearest door and back.",
  "Do your best evil villain laugh.",
  "Do a 20-second infomercial for the nearest object.",
  "Do a 15-second stand-up bit roasting the host.",
  "Dramatically re-enact how you think you'll die.",
  "Give a dramatic acceptance speech for Hot Seat of the Night.",
  "Do your best model pose and hold it until the next reveal.",
  "Act out your most-used emoji.",
  "Imitate the last person who spoke.",
  "Give the person on your right a dramatic backstory on the spot.",
  // --- Dares: speech rules ---
  "Talk about yourself in the third person until the next reveal.",
  "Whisper everything you say until the next reveal.",
  "Speak only in questions until the next reveal.",
  "Narrate the room like a nature documentary until the next reveal.",
  "Bark like a dog every time someone swears until the next reveal.",
  "Let the group pick one word you must say before every sentence until the next reveal.",
  "End every sentence with 'for legal reasons' until the next reveal.",
  "The group bans you from one word until the end of the night. Slip up, drink.",
  "Say the next three things on your mind out loud.",
  "Compliment everyone in the room in one breath.",
  // --- Dares: phone & props ---
  "Show the group your last Google search. No scrolling away.",
  "Show the room your screen-time number.",
  "Read your most recent text out loud, including who it's to.",
  "Show the group the last photo in your camera roll.",
  "Let the person on your right send one text from your phone to anyone they pick.",
  "Pick a contact at random and send them a single emoji.",
  "Swap phones with the person on your left until the next reveal. No deleting anything.",
  "Let someone draw a small doodle on the back of your hand.",
  // --- Dares: physical & misc ---
  "Keep one hand on your head until the next reveal.",
  "Do 10 squats while naming your exes out loud.",
  "Hold eye contact with the person on your left until the next reveal. Laugh and you drink.",
  "Swap one visible item of clothing with the person on your left.",
  "Swap seats with the person on your left.",
  "Switch seats with someone and copy their energy for a round.",
  "Propose to the nearest object like you mean it.",
  "The group gives you a nickname for the night. Only answer to it.",
  "Give the person on your right a genuine compliment, then take a sip.",
  "Do an impression of the host until the next reveal.",
];

// Pure non-drinking dares, for the "swap a sip for a dare" option. No drinking here.
export const DARES = [
  "Do your best impression of someone else in the room.",
  "Talk in an accent until the next reveal.",
  "Serenade the person across from you for 15 seconds.",
  "Show the group your last Google search. No scrolling away.",
  "Show the room your screen-time number.",
  "Read your most recent text out loud, including who it's to.",
  "Show the group the last photo in your camera roll.",
  "Talk about yourself in the third person until the next reveal.",
  "Whisper everything you say until the next reveal.",
  "Speak only in questions until the next reveal.",
  "The group gives you a nickname for the night. Only answer to it.",
  "Keep one hand on your head until the next reveal.",
  "Do 10 squats.",
  "Do 10 pushups.",
  "Dramatically re-enact how you think you'll die.",
  "Narrate the room like a nature documentary until the next reveal.",
  "Do your best catwalk to the nearest door and back.",
  "Do your best evil villain laugh.",
  "Compliment everyone in the room in one breath.",
  "Do a 20-second infomercial for the nearest object.",
  "Do your best model pose and hold it until the next reveal.",
  "Sing your next sentence like it's a musical.",
  "Imitate the last person who spoke.",
  "Do an impression of the host until the next reveal.",
  "Give a dramatic acceptance speech for Hot Seat of the Night.",
  "Swap seats with the person on your left.",
];

export function promptsForMode(mode) {
  if (mode === 'chaos') {
    // Everything mixed.
    return [...PROMPTS.chill, ...PROMPTS.roast, ...PROMPTS.spicy];
  }
  if (mode === 'duel') {
    // Head-to-head "who's more likely" — clean and roast prompts both work.
    return [...PROMPTS.chill, ...PROMPTS.roast];
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
