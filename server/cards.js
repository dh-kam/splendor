// Splendor Card Deck definitions (standard distribution)
// 5 colors: white, blue, green, red, black

export const NOBLES = [
  { id: 'n1', points: 3, cost: { red: 3, green: 3, blue: 3 } },
  { id: 'n2', points: 3, cost: { white: 3, blue: 3, black: 3 } },
  { id: 'n3', points: 3, cost: { white: 3, red: 3, black: 3 } },
  { id: 'n4', points: 3, cost: { blue: 3, green: 3, red: 3 } },
  { id: 'n5', points: 3, cost: { white: 3, green: 3, black: 3 } },
  { id: 'n6', points: 3, cost: { red: 4, green: 4 } },
  { id: 'n7', points: 3, cost: { blue: 4, white: 4 } },
  { id: 'n8', points: 3, cost: { black: 4, red: 4 } },
  { id: 'n9', points: 3, cost: { green: 4, blue: 4 } },
  { id: 'n10', points: 3, cost: { white: 4, black: 4 } }
];

export const LEVEL_1_CARDS = [
  // White cards
  { id: 'w1_1', level: 1, color: 'white', points: 0, cost: { blue: 1, green: 1, red: 1, black: 1 } },
  { id: 'w1_2', level: 1, color: 'white', points: 0, cost: { blue: 1, green: 2, red: 1, black: 1 } },
  { id: 'w1_3', level: 1, color: 'white', points: 0, cost: { blue: 2, green: 2, black: 1 } },
  { id: 'w1_4', level: 1, color: 'white', points: 0, cost: { blue: 2, white: 1, black: 2 } },
  { id: 'w1_5', level: 1, color: 'white', points: 0, cost: { red: 3 } },
  { id: 'w1_6', level: 1, color: 'white', points: 0, cost: { blue: 1, red: 2, black: 2 } },
  { id: 'w1_7', level: 1, color: 'white', points: 0, cost: { white: 3 } },
  { id: 'w1_8', level: 1, color: 'white', points: 1, cost: { green: 4 } },

  // Blue cards
  { id: 'u1_1', level: 1, color: 'blue', points: 0, cost: { white: 1, green: 1, red: 1, black: 1 } },
  { id: 'u1_2', level: 1, color: 'blue', points: 0, cost: { white: 1, green: 1, red: 2, black: 1 } },
  { id: 'u1_3', level: 1, color: 'blue', points: 0, cost: { white: 1, green: 2, red: 2 } },
  { id: 'u1_4', level: 1, color: 'blue', points: 0, cost: { white: 1, blue: 1, green: 3 } },
  { id: 'u1_5', level: 1, color: 'blue', points: 0, cost: { black: 3 } },
  { id: 'u1_6', level: 1, color: 'blue', points: 0, cost: { white: 2, green: 1, black: 2 } },
  { id: 'u1_7', level: 1, color: 'blue', points: 0, cost: { blue: 3 } },
  { id: 'u1_8', level: 1, color: 'blue', points: 1, cost: { red: 4 } },

  // Green cards
  { id: 'g1_1', level: 1, color: 'green', points: 0, cost: { white: 1, blue: 1, red: 1, black: 1 } },
  { id: 'g1_2', level: 1, color: 'green', points: 0, cost: { white: 1, blue: 1, red: 1, black: 2 } },
  { id: 'g1_3', level: 1, color: 'green', points: 0, cost: { blue: 1, red: 2, black: 2 } },
  { id: 'g1_4', level: 1, color: 'green', points: 0, cost: { blue: 1, green: 1, red: 3 } },
  { id: 'g1_5', level: 1, color: 'green', points: 0, cost: { white: 3 } },
  { id: 'g1_6', level: 1, color: 'green', points: 0, cost: { white: 2, blue: 2, red: 1 } },
  { id: 'g1_7', level: 1, color: 'green', points: 0, cost: { green: 3 } },
  { id: 'g1_8', level: 1, color: 'green', points: 1, cost: { black: 4 } },

  // Red cards
  { id: 'r1_1', level: 1, color: 'red', points: 0, cost: { white: 1, blue: 1, green: 1, black: 1 } },
  { id: 'r1_2', level: 1, color: 'red', points: 0, cost: { white: 2, blue: 1, green: 1, black: 1 } },
  { id: 'r1_3', level: 1, color: 'red', points: 0, cost: { white: 2, green: 1, black: 2 } },
  { id: 'r1_4', level: 1, color: 'red', points: 0, cost: { white: 1, red: 1, black: 3 } },
  { id: 'r1_5', level: 1, color: 'red', points: 0, cost: { blue: 3 } },
  { id: 'r1_6', level: 1, color: 'red', points: 0, cost: { white: 2, blue: 2, green: 1 } },
  { id: 'r1_7', level: 1, color: 'red', points: 0, cost: { red: 3 } },
  { id: 'r1_8', level: 1, color: 'red', points: 1, cost: { white: 4 } },

  // Black cards
  { id: 'k1_1', level: 1, color: 'black', points: 0, cost: { white: 1, blue: 1, green: 1, red: 1 } },
  { id: 'k1_2', level: 1, color: 'black', points: 0, cost: { white: 1, blue: 2, green: 1, red: 1 } },
  { id: 'k1_3', level: 1, color: 'black', points: 0, cost: { white: 2, blue: 2, red: 1 } },
  { id: 'k1_4', level: 1, color: 'black', points: 0, cost: { green: 1, black: 1, red: 3 } },
  { id: 'k1_5', level: 1, color: 'black', points: 0, cost: { green: 3 } },
  { id: 'k1_6', level: 1, color: 'black', points: 0, cost: { blue: 2, green: 2, red: 1 } },
  { id: 'k1_7', level: 1, color: 'black', points: 0, cost: { black: 3 } },
  { id: 'k1_8', level: 1, color: 'black', points: 1, cost: { blue: 4 } }
];

export const LEVEL_2_CARDS = [
  // White cards
  { id: 'w2_1', level: 2, color: 'white', points: 1, cost: { red: 5 } },
  { id: 'w2_2', level: 2, color: 'white', points: 1, cost: { white: 2, blue: 2, red: 3 } },
  { id: 'w2_3', level: 2, color: 'white', points: 2, cost: { red: 1, black: 4, green: 2 } },
  { id: 'w2_4', level: 2, color: 'white', points: 2, cost: { red: 5, black: 3 } },
  { id: 'w2_5', level: 2, color: 'white', points: 3, cost: { white: 6 } },

  // Blue cards
  { id: 'u2_1', level: 2, color: 'blue', points: 1, cost: { blue: 5 } },
  { id: 'u2_2', level: 2, color: 'blue', points: 1, cost: { blue: 2, green: 3, black: 2 } },
  { id: 'u2_3', level: 2, color: 'blue', points: 2, cost: { white: 5, blue: 3 } },
  { id: 'u2_4', level: 2, color: 'blue', points: 2, cost: { white: 2, red: 1, black: 4 } },
  { id: 'u2_5', level: 2, color: 'blue', points: 3, cost: { blue: 6 } },

  // Green cards
  { id: 'g2_1', level: 2, color: 'green', points: 1, cost: { green: 5 } },
  { id: 'g2_2', level: 2, color: 'green', points: 1, cost: { white: 3, blue: 2, green: 2 } },
  { id: 'g2_3', level: 2, color: 'green', points: 2, cost: { blue: 5, green: 3 } },
  { id: 'g2_4', level: 2, color: 'green', points: 2, cost: { white: 4, blue: 2, red: 1 } },
  { id: 'g2_5', level: 2, color: 'green', points: 3, cost: { green: 6 } },

  // Red cards
  { id: 'r2_1', level: 2, color: 'red', points: 1, cost: { white: 5 } },
  { id: 'r2_2', level: 2, color: 'red', points: 1, cost: { blue: 3, green: 2, black: 2 } },
  { id: 'r2_3', level: 2, color: 'red', points: 2, cost: { green: 5, red: 3 } },
  { id: 'r2_4', level: 2, color: 'red', points: 2, cost: { blue: 4, green: 2, red: 1 } },
  { id: 'r2_5', level: 2, color: 'red', points: 3, cost: { red: 6 } },

  // Black cards
  { id: 'k2_1', level: 2, color: 'black', points: 1, cost: { black: 5 } },
  { id: 'k2_2', level: 2, color: 'black', points: 1, cost: { white: 2, red: 2, black: 3 } },
  { id: 'k2_3', level: 2, color: 'black', points: 2, cost: { green: 4, red: 2, black: 1 } },
  { id: 'k2_4', level: 2, color: 'black', points: 2, cost: { red: 5, black: 3 } },
  { id: 'k2_5', level: 2, color: 'black', points: 3, cost: { black: 6 } }
];

export const LEVEL_3_CARDS = [
  // White cards
  { id: 'w3_1', level: 3, color: 'white', points: 3, cost: { black: 7 } },
  { id: 'w3_2', level: 3, color: 'white', points: 4, cost: { white: 3, red: 3, black: 6 } },
  { id: 'w3_3', level: 3, color: 'white', points: 4, cost: { blue: 7 } },
  { id: 'w3_4', level: 3, color: 'white', points: 5, cost: { white: 3, blue: 7 } },

  // Blue cards
  { id: 'u3_1', level: 3, color: 'blue', points: 3, cost: { white: 7 } },
  { id: 'u3_2', level: 3, color: 'blue', points: 4, cost: { white: 6, blue: 3, green: 3 } },
  { id: 'u3_3', level: 3, color: 'blue', points: 4, cost: { green: 7 } },
  { id: 'u3_4', level: 3, color: 'blue', points: 5, cost: { blue: 3, green: 7 } },

  // Green cards
  { id: 'g3_1', level: 3, color: 'green', points: 3, cost: { blue: 7 } },
  { id: 'g3_2', level: 3, color: 'green', points: 4, cost: { blue: 6, green: 3, red: 3 } },
  { id: 'g3_3', level: 3, color: 'green', points: 4, cost: { red: 7 } },
  { id: 'g3_4', level: 3, color: 'green', points: 5, cost: { green: 3, red: 7 } },

  // Red cards
  { id: 'r3_1', level: 3, color: 'red', points: 3, cost: { green: 7 } },
  { id: 'r3_2', level: 3, color: 'red', points: 4, cost: { green: 6, red: 3, black: 3 } },
  { id: 'r3_3', level: 3, color: 'red', points: 4, cost: { black: 7 } },
  { id: 'r3_4', level: 3, color: 'red', points: 5, cost: { red: 3, black: 7 } },

  // Black cards
  { id: 'k3_1', level: 3, color: 'black', points: 3, cost: { red: 7 } },
  { id: 'k3_2', level: 3, color: 'black', points: 4, cost: { white: 3, red: 6, black: 3 } },
  { id: 'k3_3', level: 3, color: 'black', points: 4, cost: { white: 7 } },
  { id: 'k3_4', level: 3, color: 'black', points: 5, cost: { white: 7, black: 3 } }
];
