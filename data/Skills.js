export const CATEGORYSKILLS = {
  Fighting:["Brawling", "Swordsmanship", "Polearms", "Axes", "Maces", "SmallBlades", "Archery", "Crossbow", "Throwing"],
  Social: ["Intimidation", "Seduction", "Psychology", "Representation", "Gambling", "Persuasion", "Deceit", 
    "Leadership", "ResistCoercion", "Bargaining"],
  Stealth: ["Stealth", "Disguise", "SleightOfHand", "Picklocking"],
  Crafting: ["Blacksmithing", "Trapping", "Bowying", "Leatherwork", "Forgery", "Medecine"],
  Knowledge: ["Survival", "Examinate", "Diplomacy", "Deduction", "History", "Language", "Tracking", "Strategy", "Geography",
     "Identify", "Religion"],
  Athletic: ["Running", "Swimming", "Resistance", "Climbing", "Riding", "Navigation"],
  Restricted: ["Thaumaturgie", "Forgerune", "Catalysme", "WordsOfPower"]
}

export const Fighting = {
Brawling: ["Strength", "Agility"],
Swordmanship: ["Strength", "Agility"],
Polearms: ["Strength", "Agility"],
Axes: ["Strength", "Agility"],
Maces: ["Strength", "Agility"],
SmallBlades: ["Strength", "Agility"],
Archery: ["Strength", "Perception"],
Crossbow: ["Perception"],
Throwing: ["Strength", "Perception"],
}

export const Social = {
Intimidation:["Constitution", "Charisme"],
Seduction:["Charisme", "Perception"],
Psychology:["Perception","Intelligence"],
Representation:["Charisme", "Intelligence"],
Gambling:["Charisme", "Intelligence"],
Persuasion:["Charisme", "Intelligence", "Perception"],
Deceit:["Charisme", "Intelligence", "Perception"],
Leadership:["Charisme", "Intelligence"],
ResistCoercion:["Bravery", "Intelligence"],
Bargaining:["Charisme", "Intelligence"]
};

export const Stealth= {
Stealth:["Agility", "Perception"],
SleightOfHand:["Dexterity", "Intelligence"],
Disguise:["Intelligence", "Dexterity"],
Picklocking:["Dexterity", "Perception"]
}

export const Crafting = {
Blacksmithing:["Strength", "Dexterity"],
Leatherwork:["Dexterity", "Perception"],
Forgery: ["Dexterity", "Perception"],
TrapMaking:["Dexterity", "Perception"],
Bowyer:["Dexterity", "Perception"],
Medecine:["Intelligence", "Dexterity"]
}

export const Knowledge = {
Survival:["Intelligence"],
Tracking:["Intelligence", "Perception"],
Examinate:["Intelligence", "Perception"],
Strategy:["Intelligence"],
Diplomacy:["Intelligence", "Charisme"],
Geography:["Intelligence"],
Deduction:["Intelligence"],
Identify:["Intelligence", "Perception"],
History:["Intelligence"],
Religion:["Intelligence"],
Language:["Intelligence"]
}

export const Athletic ={
Running:["Agility","Constitution"],
Climbing:["Strength", "Agility"],
Swimming:["Strength","Constitution"],
Riding:["Agility","Perception"],
Resistance:["Bravery", "Constitution"],
Sailing:["Dexterity", "Agility"]
}

export const Restricted = {
  Thaumaturgie:["Constitution", "Dexterity"], 
  Forgerune:["Intelligence", "Perception"],
  Catalysme:["Intelligence", "Perception"],
  WordsOfPower:["Intelligence", "Perception"]
}