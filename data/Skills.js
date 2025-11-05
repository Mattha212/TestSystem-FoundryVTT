export const CATEGORYSKILLS = {
  Social: ["Intimidation", "Seduction", "Psychology", "Representation", "Gambling", "Persuasion", "Deceit", 
    "Leadership", "ResistCoercion", "Bargaining"],
  Stealth: ["Stealth", "Disguise", "SleightOfHand", "Picklocking"],
  Crafting: ["Blacksmithing", "Trapping", "Bowying", "Leatherwork", "Forgery", "Medecine"],
  Knowledge: ["Survival", "Examinate", "Diplomacy", "Deduction", "History", "Language", "Tracking", "Strategy", "Geography",
     "Identify", "Religion"],
  Athletic: ["Running", "Swimming", "Resistance", "Climbing", "Riding", "Navigation"],
  Restricted: ["Thaumaturgie", "Forgerune", "Catalysme", "Words of Power"]
}
"Strength", "Agility", "Dexterity", "Constitution", "Charisme", "Intelligence", "Perception", "Bravery", "Vigor"
export const SOCIALSKILLS = {
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

export const StealthSkill= {
Stealth:["Agility", "Perception"],
SleightOfHand:["Dexterity", "Intelligence"],
Disguise:["Intelligence", "Dexterity"],
Lockpicking:["Dexterity", "Perception"]
}

export const CrafingSkill = {
Blacksmithing:["Strength", "Dexterity"],
Leatherwork:["Dexterity", "Perception"],
Forgery: ["Dexterity", "Perception"],
TrapMaking:["Dexterity", "Perception"],
Bowyer:["Dexterity", "Perception"],
Medecine:["Intelligence", "Dexterity"]
}

export const Knowledge = {
Survival:["Intelligence"],
Tracking:["Intelligence, Perception"],
Examinate:["Intelligence, Perception"],
Strategy:["Intelligence"],
Diplomacy:["Intelligence", "Charisme"],
Geography:["Intelligence"],
Deduction:["Intelligence"],
Identify:["Intelligence, Perception"],
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