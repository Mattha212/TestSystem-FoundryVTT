import {CATEGORYSKILLS, Social, Stealth, Crafting, Knowledge, Athletic, Restricted } from "./data/Skills.js"
console.log("mysystem.mjs loaded");

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class PJSheet extends ActorSheet {
    static get defaultOptions() {
        return mergeObject( super.defaultOptions, {
            classes: ["testsystem","sheet","actor"],
            template: "systems/testsystem/templates/pj-sheet.html",
            width: 500,
            height: 300
        });
    }

    getData(options){
        const context = super.getData(options);
        context.system = context.actor.system;
        const stats = context.system.stats;
        const skills = context.system.skills;
        context.stats = stats;
        context.skills = context.system.skills;
        context.skills = {
            social: skills.Social,
            stealth: skills.Stealth,
            craftmanship: skills.Craftmanship,
            knowledge: skills.Knowledge,
            physical: skills.Physical,
            restricted: skills.Restricted
        };

        context.traits = context.actor.items.filter(i=>i.type === "Trait");
        context.objects = context.actor.items.filter(i=>i.type === "Object");

        for (const key in stats) {
        if (stats[key].MaxValue == null) stats[key].MaxValue = 0;
        if (stats[key].CurrentValue == null) stats[key].CurrentValue = 0;
        }

        return context;
    }

    activateListeners(html){
        super.activateListeners(html);
        this._tabs = this._tabs || {};
        this._tabs["primary"] = new Tabs({
            navSelector: ".sheet-tabs",
            contentSelector: ".sheet-body",
            initial: "stats",
            callback: () => {}
        });
        this._tabs["primary"].bind(html[0]);

        html.find(".item-name").click(ev => {
            const li = $(ev.currentTarget).closest(".item");
            const item = this.actor.items.get(li.data("itemId"));
            item.sheet.render(true);
        });

        html.find(".stat-roll").click(this._onRollStat.bind(this));
        html.find(".skill-roll").click(this._OnRollSkill.bind(this));
    }

    async _onChangeInput(event){
        const input = event.target;
        const update={};

        if(input.name?.endsWith(".MaxValue")){
            const statKey = input.name.split(".")[2];
            const newValue = Number(input.value);

            update[`system.stats.${statKey}.MaxValue`] = newValue;
            update[`system.stats.${statKey}.CurrentValue`]= newValue;
            
            await this.actor.update(update);
        }
        if(input.name?.endsWith(".CurrentValue")){
            const statKey = input.name.split(".")[2];
            const newValue = Number(input.value);
            const label = this.actor.system.stats[statKey].Label;

            if(label === "Constitution"){
            const currentValue = this.actor.system.stats[statKey].CurrentValue;
            const maxValue = this.actor.system.stats[statKey].MaxValue;
            const MaxValueStrength = this.actor.system.stats["Strength"].MaxValue;
            const MaxValueAgility = this.actor.system.stats["Agility"].MaxValue;

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
        await this.actor.update(update);

        await super._onChangeInput(event);

    }
    
    async _onRollStat(event){
        event.preventDefault();
        const button = event.currentTarget;
        const statKey = button.dataset.stat;
        const stat = this.actor.system.stats[statKey];
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
        <p>${modifier}</p>
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

    async _OnRollSkill(event){
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
        const skills = this.actor.system.skills[skillCategory];
        const skill = this.actor.system.skills[skillCategory][skillKey];
        const values = skill.map(s=>this.actor.system.stats[s].CurrentValue || 0);
        const average = values.reduce((a,b)=> a+b,0)/ values.length;
        const form = html[0].querySelector("form");
        const modifier = 10 * (Number(form.modifier.value) || 0);       
        
        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate({async: true});
        const valueRolled = roll.total;
        const valueTested = clamp(average + modifier,5,95);
        const test = valueTested >=valueRolled;
        const testDegree = Math.floor((valueTested - valueRolled) /10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-skill-roll">
        <h3>Skill roll: ${skillKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>${modifier}</p>
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
}

class ObjectSheet extends ItemSheet{
    static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
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

class TraitSheet extends ItemSheet{
    static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["testsystem", "sheet", "item"],
      template: "systems/testsystem/templates/trait-sheet.html",
      width: 400,
      height: 300
    });
  }
}

Hooks.on("preCreateActor", (actor, data, options, userId) => {
  if (data.type !== "PJ") return;

  const system = data.system ?? {};
  const categoryData = {
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
          system.skills[category][skill] = { stats: data[skill] || [] };
        }
      }
    }

  actor.updateSource({ system });
});


Hooks.once("init", ()=>{
  console.log("✅ TestSystem Init Hook");

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("testsystem", PJSheet, {
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

    Handlebars.registerHelper("capitalize", function (str) {
    if (typeof str !== "string") return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
    });
    Handlebars.registerHelper("includes", function (array, value) {
    return array.includes(value);
  });
});


