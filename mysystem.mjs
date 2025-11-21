import {CATEGORYSKILLS, Social, Stealth, Crafting, Knowledge, Athletic, Restricted, Fighting } from "./data/Skills.js"

console.log("mysystem.mjs loaded");

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class PJSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.DocumentSheetV2) {
    static DEFAULT_OPTIONS = {
        id:"pj-sheet",
        classes: ["testsystem","sheet","actor"],
        position:{
            width: 500,
            height: 300,
        },
        window:{
            title: "Character sheet",
            resizable: true,
        },
        actions:{
            deleteTrait: this.#_onRemoveTrait,
            statRoll: this.#_onRollStat,
            skillRoll: this.#_OnRollSkill,
            itemName: this.#_OnPrintItem
        }, 
        events:{
            'change select[name="system.culture"]': this.#_OnCultureChange,
            'change select[name="system.subculture"]': this.#_OnSubCultureChange,
            'change input[name^="system.stats"]': this.#_OnChangeStat,
            'change input[name^="system.skills"]': this.#_OnChangeSkills,
            'change input[name^="system.culture"]': this.#_OnChangeCulture,
            'change input[name^="system.subculture"]': this.#_OnChangeSubCulture
        }
    }
    static PARTS = {
        form : {
            template : "systems/testsystem/templates/pj-sheet.html"
        }
    }
    static TABS = {
        sheet:{
            tabs:[
                {id: 'Skills', group: 'sheet', label: 'DCC.Skills'},
                {id:'Fighting', group: 'sheet', label: 'DCC.Fighting'},
                {id: 'Inventory', group: 'sheet', label: 'DCC.Inventory'}
            ],
            initial: 'Skills'
        }
    }

    async _prepareContext(options){
        const context = await super._prepareContext(options);
        context.system = this.document.system;
        const stats = context.system.stats;
        context.stats = stats;
        context.skills = this.document.system.skills;

        context.traits = this.document.items.filter(i=>i.type === "Trait");
        context.objects = this.document.items.filter(i=>i.type === "Object");
        context.shields = this.document.items.filter(i=>i.type === "Shield");
        context.armor = this.document.items.filter(i=>i.type === "Armor");
        const allCultures = game.items.filter(i=>i.type === "Culture");
        const allSubcultures = game.items.filter(i=>i.type === "Subculture");

        context.cultures = allCultures;
        context.subcultures = allSubcultures.filter(i=> i.system.parentCulture === context.system.culture)

        for (const key in stats) {
            if (stats[key].MaxValue == null) stats[key].MaxValue = 0;
            if (stats[key].CurrentValue == null) stats[key].CurrentValue = 0;
        }

        return context;
    }

    async _attachListeners(html) {
        await super._attachListeners(html);
        console.log("attached done");
        this._activateTabControllers(html, this.options);
    }

    async _attachPartListeners(html, partOptions) {
        await super._attachPartListeners(html, partOptions);
        this._activateTabControllers(html, this.options);
    }

    static async #_OnChangeStat(event, target, sheet){
        const input = target;
        const statKey = input.name.split(".")[2];
        const newValue = Number(input.value);
        const update={};

        if(input.name?.endsWith(".MaxValue")){
            update[`system.stats.${statKey}.MaxValue`] = newValue;
            update[`system.stats.${statKey}.CurrentValue`]= newValue;
            
            await sheet.actor.update(update);
        }
        else if(input.name?.endsWith(".CurrentValue")){
            const label = sheet.actor.system.stats[statKey].Label;

            if(label === "Constitution"){
            const currentValue = sheet.actor.system.stats[statKey].CurrentValue;
            const maxValue = sheet.actor.system.stats[statKey].MaxValue;
            const MaxValueStrength = sheet.actor.system.stats["Strength"].MaxValue;
            const MaxValueAgility = sheet.actor.system.stats["Agility"].MaxValue;

            if(newValue>maxValue*0.75){
                update[`system.stats.${"Agility"}.CurrentValue`] = MaxValueAgility;
                update[`system.stats.${"Strength"}.CurrentValue`] = MaxValueStrength;
            }
            if(newValue<=maxValue*0.75 && newValue>maxValue*0.5){
                update[`system.stats.${"Agility"}.CurrentValue`] = MaxValueAgility - 10;
            }
            else if(newValue<=maxValue*0.5 && newValue>maxValue*0.25){
                update[`system.stats.${"Strength"}.CurrentValue`] = MaxValueStrength -10;
            }
            else if(newValue<=maxValue*0.25 && newValue>0){
                update[`system.stats.${"Agility"}.CurrentValue`] = MaxValueAgility - 20;
                update[`system.stats.${"Strength"}.CurrentValue`] = MaxValueStrength -20;
            }
            update[`system.stats.${statKey}.CurrentValue`]= newValue;
            }
        }
        await sheet.actor.update(update);
    }

    static async #_OnChangeSkills(event, target, sheet){
        const input = target;
        const update={};
        if(input.name?.endsWith(".level")){
            const categoryKey = input.name.split(".")[2];
            const skillKey = input.name.split(".")[3];
            const newValue = Number(input.value);
            update[`system.skills.${categoryKey}.${skillKey}.level`] = newValue;
        }
        await sheet.actor.update(update);
    } 

    static async #_OnChangeCulture(event, target, sheet){
        const input = target;
        const update={};
        if(input.name?.endsWith(".Culture")){
            const value = String(input.value);
            update[`system.culture`] = value;
        }
        await sheet.actor.update(update);
    }

    static async #_OnChangeSubCulture(event, target, sheet){
        const input = target;
        const update={};
        if(input.name?.endsWith(".Subculture")){
            const value = String(input.value);
            update[`system.subculture`] = value;
        }
        await sheet.actor.update(update);
    }

    static async #_OnSubCultureChange(event, sheet){
        const subCulture = event.target.value;
        const existingSubCulture = sheet.actor.items.filter(i=> i.type === "Subculture");
        if(existingSubCulture.length>0){
            await sheet.actor.deleteEmbeddedDocuments("Item", existingSubCulture.map(i=> i.id) );
        }
        if(subCulture.length>0){
            const cultureItem = game.items.find(i=> i.name === subCulture).toObject();
            await sheet.actor.createEmbeddedDocuments("Item", [cultureItem]);
        }
    }

    static async #_OnCultureChange(event, sheet){
        const culture = event.target.value;
        const existingCultures = sheet.actor.items.filter(i=> i.type === "Culture");
        const existingSubCulture = sheet.actor.items.filter(i=> i.type === "Subculture");
        if(existingCultures.length>0) {
            await sheet.actor.deleteEmbeddedDocuments("Item", existingCultures.map(i=> i.id) );
        }
        if(existingSubCulture.length>0){
            await sheet.actor.deleteEmbeddedDocuments("Item", existingSubCulture.map(i=> i.id) );
        }

        if(culture.length>0){
            const cultureItem = game.items.find(i=> i.name === culture).toObject();
            await sheet.actor.createEmbeddedDocuments("Item", [cultureItem]);
        }

        await sheet.actor.update({ "system.culture": culture });
        const root = sheet.element;
        const subSelect = root.querySelector('select[name="system.subculture"]');

        const allSubcultures = game.items.filter(i => i.type === "Subculture");
        const subcultures = allSubcultures.filter(s => s.system.parentCulture === culture);
        subSelect.innerHTML = `<option value="">-- Sélectionne une sous-culture --</option>`;

        for (const s of subcultures){
            const opt = document.createElement("option");
            opt.value = s.name;
            opt.textContent = s.name;
            subSelect.appendChild(opt);
        } 
    }

    static async #_OnPrintItem(event, target, sheet){
        const li = $(target).closest(".item");
        const item = sheet.actor.items.get(li.data("itemId"));
        item.sheet.render(true);
    }

    static async #_onRollStat(event, target, sheet){
        event.preventDefault();
        const statKey = target.dataset.stat;
        const stat = sheet.actor.system.stats[statKey];
        if(!stat) return;

        const content =`
        <form class = "difficulty-Modifier-form">
            <div class = "difficulty-Modifier-group" >
                <label>Modifier</label>
                <input type = number name = "modifier" value="0">
            </div>
        </form>
        `;

        new Dialog({
            title: `${statKey} roll`,
            content,
            buttons:{
                roll:{
                    label: "Roll",
                    callback: html => this._onConfirmRollStat(html,statKey)
                },
                cancel:{
                    label: "Cancel"
                }
            },
                default: "roll"
            }).render(true);
    }

    async _onConfirmRollStat(html, statKey){
        const stat = this.actor.system.stats[statKey];
        const currentValueStat = stat.CurrentValue;

        const form = html[0].querySelector("form");
        const modifier = 10 * (Number(form.modifier.value) || 0);       
        
        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate({async: true});
        const valueRolled = roll.total;
        const valueTested = clamp(currentValueStat + modifier,5,95);
        const test = valueTested >=valueRolled;
        const testDegree = Math.floor((valueTested - valueRolled) /10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-stat-roll">
        <h3>Stat roll: ${statKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>Success Degree: ${testDegree} </p>
        </div>
        `;

        await ChatMessage.create({
            speaker:ChatMessage.getSpeaker({actor:this.actor}),
            content:message,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll,
        })

        if(test){
            ui.notifications.info(`il se passe des trucs`);
        }
        else{
            ui.notifications.info(`il se passe rien`);
        }
    }

    static async #_OnRollSkill(event, sheet){
        event.preventDefault();
        const button = event.currentTarget;
        const skillKey = button.dataset.skillkey;
        const skillCategory = button.dataset.category;

        const content =`
        <form class = "difficulty-Modifier-form">
            <div class = "difficulty-Modifier-group" >
                <label>Modifier</label>
                <input type = number name = "modifier" value="0">
            </div>
        </form>
        `;
        new Dialog({
            title: `${skillKey} roll`,
            content,
            buttons:{
                roll:{
                    label: "Roll",
                    callback: html => this._onConfirmRollSkill(html,skillKey, skillCategory)
                },
                cancel:{
                    label: "Cancel"
                }
            },
                default: "roll"
            }).render(true);
    }

    async _onConfirmRollSkill(html, skillKey, skillCategory){
        const statsSkill = this.actor.system.skills[skillCategory][skillKey].stats;
        const skillLevel = this.actor.system.skills[skillCategory][skillKey].level;
        const values = statsSkill.map(s=>this.actor.system.stats[s].CurrentValue || 0);
        const average = values.reduce((a,b)=> a+b,0)/ values.length;
        const form = html[0].querySelector("form");
        const levelModifierValue = skillLevel *5;
        const modifier = 10 * (Number(form.modifier.value) || 0);       
        
        const statDetails = statsSkill.map(s => {
        const val = this.actor.system.stats[s]?.CurrentValue ?? 0;
        return `${s}(${val})`;
        }).join(" + ");

        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate({async: true});
        const valueRolled = roll.total;
        const valueTested = clamp(average + modifier + levelModifierValue,5,95);
        const test = valueTested >=valueRolled;
        const testDegree = Math.floor((valueTested - valueRolled) /10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-skill-roll">
        <h3>Skill roll: ${skillKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>${statDetails}</p>
        <p>Level: ${skillLevel} (+ ${levelModifierValue}%)</p>
        <p>Success Degree: ${testDegree} </p>
        </div>
        `;

        await ChatMessage.create({
            speaker:ChatMessage.getSpeaker({actor:this.actor}),
            content:message,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll,
        })

        if(test){
            ui.notifications.info(`il se passe des trucs`);
        }
        else{
            ui.notifications.info(`il se passe rien`);
        }
    }

    static async #_onRemoveTrait(event, target, sheet){
        event.preventDefault();
        const traitToRemoveId = target.dataset.traitId;
        await sheet.actor.deleteEmbeddedDocuments("Item", [traitToRemoveId]);
    }
}

class ObjectSheet extends ItemSheet{
    static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["testsystem", "sheet", "item"],
      template: "systems/testsystem/templates/object-sheet.html",
      width: 400,
      height: 300
    });
  }

  getData(options) {
    const context = super.getData(options);
    context.system = context.item.system;
    return context;
  }
}

class InfoObjectSheet extends ItemSheet{
activateListeners(html){
    super.activateListeners(html);

    html.find(".add-effect").click(this._OnAddEffect.bind(this))
    html.find(".edit-effect").click(this._OnEditEffect.bind(this))
    html.find(".remove-effect").click(this._OnRemoveEffect.bind(this))

  }
  async _OnAddEffect(event){
    event.preventDefault();
    const effectData = {
      label: "new Effect",
      changes: [],
      icon: "icons/svg/aura.svg",
      origin: this.item.uuid,
    };
    await this.item.createEmbeddedDocuments("ActiveEffect", [effectData]);

  }
  
  async _OnEditEffect(event){
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    const effect = this.item.effects.find(e => e.id === effectId);
    if (effect) effect.sheet.render(true); 
  }
  
  async _OnRemoveEffect(event){
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    await this.item.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
  }
}

class TraitSheet extends InfoObjectSheet{
    static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["testsystem", "sheet", "item"],
      template: "systems/testsystem/templates/trait-sheet.html",
      width: 400,
      height: 300
    });
  }
}

class CultureSheet extends InfoObjectSheet{
        static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["testsystem", "sheet", "item"],
      template: "systems/testsystem/templates/culture-sheet.html",
      width: 400,
      height: 300
    });
  }
}

class SubcultureSheet extends CultureSheet{
        static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["testsystem", "sheet", "item"],
      template: "systems/testsystem/templates/subculture-sheet.html",
      width: 400,
      height: 300
    });
  }
  getData(options){
    const context = super.getData(options);
    context.system = context.item.system;
    const allCultures = game.items.filter(i=>i.type === "Culture");
    context.cultures = allCultures;
    context.effect = this.item.effects.content;
    return context;
  }
}

class ShieldSheet extends InfoObjectSheet{
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["testsystem", "sheet", "item"],
        template: "systems/testsystem/templates/shield-sheet.html",
        width: 400,
        height: 300
        });
  }
}

class ArmorSheet extends InfoObjectSheet{
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["testsystem", "sheet", "item"],
        template: "systems/testsystem/templates/armor-sheet.html",
        width: 400,
        height: 300
        });
  }
}

Hooks.on("preCreateActor", (actor, data, options, userId) => {
  if (data.type !== "PJ") return;

  const system = data.system ?? {};
  const categoryData = {
        Fighting,
        Social, 
        Stealth, 
        Crafting, 
        Knowledge, 
        Athletic,
        Restricted
    }
    if (!system.skills || Object.keys(system.skills).length === 0) {
      system.skills = {};
      for (const [category, list] of Object.entries(CATEGORYSKILLS)) {
        const data = categoryData[category] || {};
        system.skills[category] = {};
        for (const skill of list) {
          system.skills[category][skill] = { stats: data[skill] || [], level: 0, learningPoints: 0 };
        }
      }
    }

  actor.updateSource({ system });
});

 
Hooks.once("init", ()=>{
  console.log("✅ TestSystem Init Hook");

    foundry.documents.collections.Actors.unregisterSheet("core", ActorSheet);

    foundry.documents.collections.Actors.registerSheet("testsystem", PJSheet, {
    types: ["PJ"],
    makeDefault: true
    });

    Items.unregisterSheet("core", ItemSheet);

    Items.registerSheet("testsystem", ObjectSheet, {
        types:["Object"],
        makeDefault:true
    });
    Items.registerSheet("testsystem", TraitSheet, {
        types:["Trait"],
        makeDefault:true
    });
    Items.registerSheet("testsystem", CultureSheet, {
        types:["Culture"],
        makeDefault:true
    });
    Items.registerSheet("testsystem", SubcultureSheet, {
        types:["Subculture"],
        makeDefault: true
    });
    Items.registerSheet("testsystem",ShieldSheet, {
        types:["Shield"],
        makeDefault:true
    });
    Items.registerSheet("testsystem", ArmorSheet, {
        types:["Armor"],
        makeDefault: true
    });

Handlebars.registerHelper("handleNames", function(str) {
  if (typeof str !== "string") return "";
  const spaced = str.replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
});
    Handlebars.registerHelper("includes", function (array, value) {
    return array.includes(value);
  });
  Handlebars.registerHelper("eq", function(a, b) {
  return a === b;
});
});

Hooks.on("updateActiveEffect", async (effect, changed, option, userId) =>{
if(!changed.changes) return;
const updates = [];
for (const change of effect.changes) {
    if (change.key.endsWith(".MaxValue")) {

      const basePath = change.key.split(".").slice(0, -1).join(".");
      const currentKey = `${basePath}.CurrentValue`;

      const exists = effect.changes.some(c => c.key === currentKey);

      if (!exists) {
        const mirrorChange = foundry.utils.duplicate(change);
        mirrorChange.key = currentKey;

        updates.push(mirrorChange);
      }
    }
  }
   if (updates.length === 0) return;

  await effect.update({
    changes: [...effect.changes, ...updates]
  });
});



