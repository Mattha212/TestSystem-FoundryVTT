import {CATEGORYSKILLS, Social, Stealth, Crafting, Knowledge, Athletic, Restricted, Fighting } from "./data/Skills.js"
import {AttackTypes, ManeuverTypes } from "./data/Actions.js"
import { ObjectSizes, ObjectSizeLabels } from "./data/Objects.js";
console.log("mysystem.mjs loaded");

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function enumToLabel(str) {
    return str
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/(^\w|\s\w)/g, m => m.toUpperCase());
}

class PJSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem","sheet","actor"],
        position:{
            width: 500,
            height: 300,
        },
        tag: 'form',
        form:{
            handler:this.#onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window:{
            title: "Character sheet",
            resizable: true,
        },
        actions:{
            deleteTrait: this.#_onRemoveTrait,
            statRoll: this.#_onRollStat,
            skillRoll: this.#_OnRollSkill,
            printItem: this.#_OnPrintItem,
            changeTab: this._onClickTab,
            deleteItem: function (event, target) { this._onDeleteItem(event, target);},
            equipArmor: function(event, target){ this._onEquipArmor(event, target);},
            unequipArmor: function(event, target){ this._onUnEquipArmor(event, target);},
            equipWeapon: function(event, target){this._onEquipWeapon(event, target) ;},
            unequipWeapon: function(event, target){this._onUnequipWeapon(event, target) ;},
            attack: function(event, target){this._onAttack(event, target);},
            defense: function(event, target){ this._onDefense(event, target);},
            maneuver: function(event, target){ this._onPerformManeuver(event, target);}
        }
    }
    static PARTS = {
        form : {
            template : "systems/testsystem/templates/pj-sheet.html",
            scrollable: ["", ".tab"],
        }
    }

    tabGroups = {
		primary: 'skillsTab'
	}
    tabs = {
        skillsTab:{
            id:'skillsTab',
            group: 'primary'
        },
        fightingTab:{
            id: 'fightingTab',
            group: 'primary'
        },
        inventoryTab:{
            id: 'inventoryTab',
            group: 'primary'
        }
    }

	getTabs () {
		const tabs = this.tabs

		for (const tab of Object.values(tabs)) {
			tab.active = this.tabGroups[tab.group] === tab.id
			tab.cssClass = tab.active ? 'item active' : 'item';
		}

		return tabs;
	}

    constructor(...args) {
        super(...args);

        this._onChangeCultureBound = this._onChangeCulture.bind(this);
        this._onChangeSubCultureBound = this._onChangeSubCulture.bind(this);
        this._onChangeStatBound = this._onChangeStat.bind(this);
        this._onChangeSkillsBound = this._onChangeSkills.bind(this);
        this._onDropBound = this._onDropItems.bind(this);
        this._OnModifyManeuverWeaponLinkedBound = this._OnModifyManeuverWeaponLinked.bind(this);
        this._OnModifyManeuverTypeBound = this._OnModifyManeuverType.bind(this);
    }

    static _onClickTab(event) {
        event.preventDefault();

        const target = event.target;
        const tab = target.dataset.tab;
        const group = target.closest(".tabs").dataset.group;

        this.tabGroups[group] = tab;
        this.render();
    }

    async _prepareContext(options){
        const context = await super._prepareContext(options);
        context.tabs = this.getTabs();
        context.actor = this.document;
        context.system = this.document.system;
        const stats = context.system.stats;
        context.stats = stats;
        context.skills = this.document.system.skills;

        context.traits = this.document.items.filter(i=>i.type === "Trait");
        context.containers = this.document.items.filter(i=>i.type === "Container");
        context.shields = this.document.items.filter(i=>i.type === "Shield");
        context.armors = this.document.items.filter(i=>i.type === "Armor");
        context.weapons = this.document.items.filter(i=>i.type === "Weapon");
        context.fightingManeuvers = this.document.items.filter(i=>i.type === "Fighting Maneuver");
        
        context.protection = this.document.system.protection;
        context.bulk = this.document.system.bulk;

        const allCultures = game.items.filter(i=>i.type === "Culture");
        const allSubcultures = game.items.filter(i=>i.type === "Subculture");

        context.cultures = allCultures;
        context.subcultures = allSubcultures.filter(i=> i.system.parentCulture === context.system.culture)

        context.maneuverTypes = Object.values(ManeuverTypes).map(k => ({
            key: k,
            label: k.charAt(0).toUpperCase() + k.slice(1)
        }));

        for (const key in stats) {
            if (stats[key].MaxValue == null) stats[key].MaxValue = 0;
            if (stats[key].CurrentValue == null) stats[key].CurrentValue = 0;
        }

        return context;
    }
    _onRender(context, options){
        this.element.querySelectorAll('select[name="system.culture"]').forEach(sel =>
            sel.addEventListener("change", this._onChangeCultureBound)
        );

        this.element.querySelectorAll('select[name="system.subculture"]').forEach(sel =>
            sel.addEventListener("change", this._onChangeSubCultureBound)
        );

        this.element.querySelectorAll('input[name*="system.stats"]').forEach(inp =>
            inp.addEventListener("change", this._onChangeStatBound)
        );

        this.element.querySelectorAll('input[name*="system.skills"]').forEach(inp =>
            inp.addEventListener("change", this._onChangeSkillsBound)
        );

        this.element.querySelectorAll('select[name="system.weaponLinked"]').forEach(sel =>
            sel.addEventListener("change", this._OnModifyManeuverWeaponLinkedBound)
        );

        this.element.querySelectorAll('select[name="system.maneuverType"]').forEach(sel =>
            sel.addEventListener("change", this._OnModifyManeuverTypeBound)
        );


        if (!this._dropListenerBound) {
            this.element.addEventListener("drop", this._onDropBound);
            this.element.addEventListener("dragover", event => event.preventDefault());
            this._dropListenerBound = true;
        }
    }

    static async #onSubmitForm(event, form, formData) {
		event.preventDefault()
        const name = event.target.name;
        const value = event.target.value;
        const update = {};
		update[name] = value;
        await this.document.update(update);
    }

    async _onDropItems(event) {
        event.preventDefault();
        const dataTransfer = event.dataTransfer;
        if (!dataTransfer) return;
        const dataString = dataTransfer.getData("text/plain");
        if (!dataString) return;

        let itemData;

        const parsed = JSON.parse(dataString);
        const item = await fromUuid(parsed.uuid);
        if(!item) return;
        itemData = {
            name: item.name || "Unnamed Item",
            type: item.type,
            system: item.system || {}
        };
        if(itemData.type === "Container"){
            itemData.system.isUsed = true;
        }
        if("weight" in itemData.system){
            itemData.system.quantity = 1;
        }
        
        await this.document.createEmbeddedDocuments("Item", [itemData]);
    }

    async _onDeleteItem(event,target){
        event.preventDefault();
        const itemToRemoveId = target.dataset.itemId;
        const item = this.document.items.get(itemToRemoveId).toObject();
        if(item.type === "Container"){
            for(const element of item.system.contents){
                const elementId = element.split(".")[3];
                await this.document.deleteEmbeddedDocuments("Item", [elementId]);
            }
        }

        await this.document.deleteEmbeddedDocuments("Item", [itemToRemoveId]);
        const equipment = this.document.system.equipment;
        let typeOfItem = null;
        let isInEquipment = false;
        for(const [type, equip] of Object.entries(equipment)){
            if(equip.id === itemToRemoveId){
                typeOfItem = type
                isInEquipment = true;
            }
        }
        if(isInEquipment && (typeOfItem === "Armor" || typeOfItem === "Shield")){
		    await this._onUnEquipArmor(event, target);
        }
        if(isInEquipment &&(typeOfItem === "Weapon")){
            await this._onUnequipWeapon(event, target);
        }
    }

	async _onUnEquipArmor(event, target){
        const itemType = target.dataset.itemType;
        const update = {};
        update[`system.equipment.${itemType}`] = {"id":"","protection":0, "bulk":0, "type":""};
	    await this.document.update(update);
	    this._OnUpdateEquipment();
	}

    async _onEquipArmor(event, target){
        event.preventDefault();
        const itemType = target.dataset.itemType;
        const itemId = target.dataset.itemId;
        const object = this.document.items.get(itemId).toObject();
        const update = {};
        update[`system.equipment.${itemType}.id`] = itemId;
        update[`system.equipment.${itemType}.protection`] =  object.system.protection;
        update[`system.equipment.${itemType}.bulk`] =  object.system.bulk;
        update[`system.equipment.${itemType}.type`] =  object.system.type;
        await this.document.update(update);
	    this._OnUpdateEquipment();
    }

    async _onEquipWeapon(event, target){
        event.preventDefault();
        const itemId = target.dataset.itemId;
        const object = this.document.items.get(itemId).toObject();
        const update = {};
        update[`system.equipment.Weapon.id`] = itemId;
        update[`system.equipment.Weapon.efficiency`] =  object.system.efficiency;
        update[`system.equipment.Weapon.bulk`] =  object.system.bulk;
        update[`system.equipment.Weapon.type`] =  object.system.type;
        update[`system.equipment.Weapon.reach`] = object.system.reach;
        update[`system.equipment.Weapon.skill`] = object.system.skill;
        await this.document.update(update);
	    this._OnUpdateEquipment();
    }

    async _onUnequipWeapon(event, target){
        const update = {};
        update[`system.equipment.Weapon`] = {"id":"", "efficiency":{"textile":0,"fluide":0,"solid":0},"bulk":0, "reach":0};
	    await this.document.update(update);
	    this._OnUpdateEquipment();
    }

    async _OnUpdateEquipment(){
		const update = {};
        let currentBulk =0;
        let currentProtection = 0;
        for(const value of Object.values(this.document.system.equipment)){
			currentBulk += Number(value?.bulk ?? 0);
	        currentProtection += Number(value?.protection ?? 0);
        }
        update[`system.protection`] = currentProtection;
        update[`system.bulk`] = currentBulk;
        await this.document.update(update);
    }

    _onAttack(event, target){
        event.preventDefault();
        const skillKey = target.dataset.itemSkillkey;

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
                    callback: html => this._onConfirmAttack(html,skillKey)
                },
                cancel:{
                    label: "Cancel"
                }
            },
                default: "roll"
            }).render(true);
    }

    async _onConfirmAttack(html,skillKey){
        const statsSkill = this.document.system.skills["Fighting"][skillKey].stats;
        const skillLevel = this.document.system.skills["Fighting"][skillKey].level;
        const values = statsSkill.map(s=>this.document.system.stats[s].CurrentValue || 0);
        const average = values.reduce((a,b)=> a+b,0)/ values.length;
        const form = html[0].querySelector("form");
        const levelModifierValue = skillLevel *5;
        const modifier = 10 * (Number(form.modifier.value) || 0);       
        
        const statDetails = statsSkill.map(s => {
        const val = this.document.system.stats[s]?.CurrentValue ?? 0;
        return `${s}(${val})`;
        }).join(" + ");

        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate();
        const valueRolled = roll.total;
        const valueTested = clamp(average + modifier + levelModifierValue,5,95);
        const test = valueTested >=valueRolled;
        const testSign = Math.sign(valueTested - valueRolled); 
        const testDegree = testSign * Math.floor(Math.abs(valueTested - valueRolled) /10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-skill-roll">
        <h3>Attack roll: ${skillKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>${statDetails}</p>
        <p>Level: ${skillLevel} (+ ${levelModifierValue}%)</p>
        <p>Success Degree: ${testDegree} </p>
        </div>
        `;

        await ChatMessage.create({
            speaker:ChatMessage.getSpeaker({actor:this.actor}),
            content:message,
            rolls: [roll],
        })
    }

    _onDefense(event, target){
        event.preventDefault();
        const skillKey = target.dataset.itemSkillkey;
        const options =
            Object.entries(AttackTypes)
                .map(([key, value]) =>
                    `<option value="${value}">${enumToLabel(key)}</option>`
                ).
                join("");
        const content =
        `<form>
            <form class="form-group">
                <div class = "difficulty-Modifier-group" >
                    <label>Modifier</label>
                    <input type = number name = "modifier" value="0">
                </div>
                <div class = "attack-type">
                    <label>Attack Type</label>
                    <select id="attack-select" name="attackType">
                        ${options}
                    </select>
                </div>
            </form>
        </form>`;
        new Dialog({
            title: `${skillKey} defense roll`,
            content,
            buttons:{
                roll:{
                    label: "Roll",
                    callback: html => this._onConfirmDefense(html,skillKey)
                },
                cancel:{
                    label: "Cancel"
                }
            },
                default: "roll"
            }).render(true);
    }

        async _onConfirmDefense(html, skillKey){
        const statsSkill = this.document.system.skills["Fighting"][skillKey].stats;
        const skillLevel = this.document.system.skills["Fighting"][skillKey].level;
        const values = statsSkill.map(s=>this.document.system.stats[s].CurrentValue || 0);
        const average = values.reduce((a,b)=> a+b,0)/ values.length;
        const form = html[0].querySelector("form");
        const levelModifierValue = skillLevel *5;
        const modifier = 10 * (Number(form.modifier.value) || 0);       
        
        const statDetails = statsSkill.map(s => {
        const val = this.document.system.stats[s]?.CurrentValue ?? 0;
        return `${s}(${val})`;
        }).join(" + ");

        let protectionBaseValue = Number(this.document.system.equipment.Armor.protection);
        const attackType = form.attackType.value;
        const attackTypeNumber = Number(attackType);
        let attackTypeLabel="";
        switch(attackTypeNumber){
            case AttackTypes.INNEFICIENT:
                protectionBaseValue *= 2;
                attackTypeLabel= "Inneficient attack";
                break;
            case AttackTypes.CLASSIC:
                attackTypeLabel= "Classic attack";
                break;
            case AttackTypes.EFFICIENT:
                attackTypeLabel= "Efficient attack";
                protectionBaseValue /= 2;
                break;
            case AttackTypes.VERY_EFFICIENT:
                attackTypeLabel= "Very efficient attack";
                protectionBaseValue = 0;
                break;
            
        }
		const TotalProtection = protectionBaseValue + Number(this.document.system.equipment.Shield.protection);
        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate();
        const valueRolled = roll.total - TotalProtection;
        const valueTested = clamp(average + modifier + levelModifierValue,5,95);
        const test = valueTested >=valueRolled;
        const testSign = Math.sign(valueTested - valueRolled); 
        const testDegree = testSign * Math.floor(Math.abs(valueTested - valueRolled) /10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-skill-roll">
        <h3>Defense roll: ${skillKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>${statDetails}</p>
        <p>Level: ${skillLevel} (+ ${levelModifierValue}%)</p>
        <p>Protection:${TotalProtection} ( ${attackTypeLabel} )
        <p>Success Degree: ${testDegree} </p>
        </div>
        `;

        await ChatMessage.create({
            speaker:ChatMessage.getSpeaker({actor:this.actor}),
            content:message,
            rolls: [roll],
        })
    }

    _onPerformManeuver(event, target){
        const weaponLinked = this.document.system.equipment.Weapon;
        const maneuverId = target.dataset.itemId;
        const maneuver = this.document.items.get(maneuverId);
        const schoolOfManeuver = game.items.filter(i=> i.type === "Fighting School" && i.name===maneuver.system.school)[0];

        if(weaponLinked.id.length===0) return;
        const weaponSkill = weaponLinked.skill;
        target.dataset.itemSkillkey = weaponSkill;

        if(schoolOfManeuver.system.skillsAllowed.includes(weaponSkill)){
            if(maneuver.system.maneuverType == "attack"){
                this._onAttack(event, target);
            }
            else if(maneuver.system.maneuverType == "defense"){
                this._onDefense(event, target);
            }
        }
        else{
             const content =`
        <form class = "maneuver-roll-confirmation-form">
            <div class = "maneuver-roll-confirmation-group" >
                <label>Your weapon is not appropriate for this kind of maneuver. Are you certain you want to try it?</label>
            </div>
        </form>
        `;
        new Dialog({
            title: `Confirmation`,
            content,
            buttons:{
                rollAttack:{
                    label: "Roll Attack",
                    callback: html => this._onAttack(event, target)
                },
                rollDefense:{
                    label: "Roll Defense",
                    callback: html => this._onDefense(event, target)
                },
                cancel:{
                    label: "Cancel"
                }
            },
                default: "roll"
            }).render(true);
        }
    }

    async _onChangeStat(event){
        event.preventDefault();
		event.stopPropagation();

        const input = event.target;
        const statKey = input.name.split(".")[2];
        const newValue = Number(input.value);
        const update={};

        if(input.name?.endsWith(".MaxValue")){
            update[`system.stats.${statKey}.MaxValue`] = newValue;
            update[`system.stats.${statKey}.CurrentValue`]= newValue;
                    }
        else if(input.name?.endsWith(".CurrentValue")){
            const label = this.document.system.stats[statKey].Label;

            if(label === "Constitution"){
            const currentValue = this.document.system.stats[statKey].CurrentValue;
            const maxValue = this.document.system.stats[statKey].MaxValue;
            const MaxValueStrength = this.document.system.stats["Strength"].MaxValue;
            const MaxValueAgility = this.document.system.stats["Agility"].MaxValue;

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
        await this.document.update(update);
    }

    async _onChangeSkills(event){   
        event.preventDefault();
		event.stopPropagation();

        const input = event.target;
        const update={};
        if(input.name?.endsWith(".level")){
            const categoryKey = input.name.split(".")[2];
            const skillKey = input.name.split(".")[3];
            const newValue = Number(input.value);
            update[`system.skills.${categoryKey}.${skillKey}.level`] = newValue;
        }
        await this.actor.update(update);
    } 

    static async #_onRemoveTrait(event, target, sheet){
        event.preventDefault();
        const traitToRemoveId = target.dataset.traitId;
        await this.document.deleteEmbeddedDocuments("Item", [traitToRemoveId]);
    }
    
    async _onChangeCulture(event){
        event.preventDefault();
		event.stopPropagation();

        const culture = event.target.value;
        const existingCultures = this.document.items.filter(i=> i.type === "Culture");
        const existingSubCulture = this.document.items.filter(i=> i.type === "Subculture");
        if(existingCultures.length>0) {
            await this.document.deleteEmbeddedDocuments("Item", existingCultures.map(i=> i.id) );
        }
        if(existingSubCulture.length>0){
            await this.document.deleteEmbeddedDocuments("Item", existingSubCulture.map(i=> i.id) );
        }

        if(culture.length>0){
            const cultureItem = game.items.find(i=> i.name === culture).toObject();
            await this.document.createEmbeddedDocuments("Item", [cultureItem]);
        }

        await this.document.update({ "system.culture": culture });

        const root = this.element;
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

    async _onChangeSubCulture(event){
        event.preventDefault();
		event.stopPropagation();

        const subCulture = event.target.value;
        const existingSubCulture = this.document.items.filter(i=> i.type === "Subculture");
        if(existingSubCulture.length>0){
            await this.document.deleteEmbeddedDocuments("Item", existingSubCulture.map(i=> i.id) );
        }
        if(subCulture.length>0){
            const cultureItem = game.items.find(i=> i.name === subCulture).toObject();
            await this.document.createEmbeddedDocuments("Item", [cultureItem]);
        }
        await this.document.update({ "system.subculture": subCulture });

    }

    async _OnModifyManeuverWeaponLinked(event){
        event.preventDefault();
		event.stopPropagation();
        const value = event.target.value;
        const itemId = event.target.dataset.itemId;
        const item = this.document.items.get(itemId);
        if(!item) return;
        const update={};
        update[`system.weaponLinked`] = value;
        await item.update(update);
    }

    async _OnModifyManeuverType(event){
        event.preventDefault();
		event.stopPropagation();
        const value = event.target.value;
        const itemId = event.target.dataset.itemId;
        const item = this.document.items.get(itemId);
        if(!item) return;
        const update={};
        update[`system.maneuverType`] = value;
        await item.update(update);
    }

    static async #_OnPrintItem(event, target){
        event.preventDefault();

        const itemId= target.dataset.itemId;
        const itemDoc = this.document.items.get(itemId);
        itemDoc.sheet.render(true);
    }

    static async #_onRollStat(event, target){
        event.preventDefault();
        const statKey = target.dataset.stat;
        const stat = this.document.system.stats[statKey];
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
        const stat = this.document.system.stats[statKey];
        const currentValueStat = stat.CurrentValue;

        const form = html[0].querySelector("form");
        const modifier = 10 * (Number(form.modifier.value) || 0);       
        
        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate();
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
            rolls: [roll],
        })

        if(test){
            ui.notifications.info(`il se passe des trucs`);
        }
        else{
            ui.notifications.info(`il se passe rien`);
        }
    }

    static async #_OnRollSkill(event, target){
        event.preventDefault();
        const skillKey = target.dataset.skillkey;
        const skillCategory = target.dataset.category;

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
        const statsSkill = this.document.system.skills[skillCategory][skillKey].stats;
        const skillLevel = this.document.system.skills[skillCategory][skillKey].level;
        const values = statsSkill.map(s=>this.document.system.stats[s].CurrentValue || 0);
        const average = values.reduce((a,b)=> a+b,0)/ values.length;
        const form = html[0].querySelector("form");
        const levelModifierValue = skillLevel *5;
        const modifier = 10 * (Number(form.modifier.value) || 0);       
        
        const statDetails = statsSkill.map(s => {
        const val = this.document.system.stats[s]?.CurrentValue ?? 0;
        return `${s}(${val})`;
        }).join(" + ");

        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate();
        const valueRolled = roll.total;
        const valueTested = clamp(average + modifier + levelModifierValue,5,95);
        const test = valueTested >=valueRolled;
        const testSign = Math.sign(valueTested - valueRolled); 
        const testDegree = testSign * Math.floor(Math.abs(valueTested - valueRolled) /10);
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
            rolls: [roll],
        })

        if(test){
            ui.notifications.info(`il se passe des trucs`);
        }
        else{
            ui.notifications.info(`il se passe rien`);
        }
    }

    _onClose(options){
        this._dropListenerBound = false;
    }
}

class InfoSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.DocumentSheetV2){

    static DEFAULT_SUBJECT = "item";

    async _prepareContext(options){
        const context = await super._prepareContext(options);   
    	context.system = this.document.system;
        context.item = this.document; 

        return context;
    }
}

class ObjectsItemsSheet extends InfoSheet{

    async _prepareContext(options){
        const context = await super._prepareContext(options);    
        context.objectSizes = ObjectSizes;
        context.objectSizeLabels = ObjectSizeLabels;

        return context;
    }

    static async onSubmitForm(event, form, formData) {
		event.preventDefault()
        const name = event.target.name;
        let value;
        if(name === "system.size" || name === "system.maxSize"){
            value = Number(event.target.value);
        }
        else{
            value = event.target.value;
        }
        const update = {};
		update[name] = value;
        await this.document.update(update);
    }    
}

class NonObjectItemsSheet extends InfoSheet{

    _onRender(context, options){
        super._onRender(context, options);
        this.element.querySelectorAll(".add-effect").forEach(inp =>
            inp.addEventListener("click", this._OnAddEffect.bind(this))
        );
        this.element.querySelectorAll(".edit-effect").forEach(inp =>
            inp.addEventListener("click", this._OnEditEffect.bind(this))
        );
        this.element.querySelectorAll(".remove-effect").forEach(inp =>
            inp.addEventListener("click", this._OnRemoveEffect.bind(this))
        );
    }

    static async onSubmitForm(event, form, formData) {
		event.preventDefault()
        const name = event.target.name;
        let value;
        if(event.target.type == "checkbox"){
            value = event.target.checked;
        }
        else{
            value = event.target.value;
        }
        const update = {};
		update[name] = value;
        await this.document.update(update);
    }

    async _OnEditEffect(event){
        event.preventDefault();
        const effectId = event.currentTarget.dataset.effectId;
        const effect = this.document.effects.get(effectId);
        if (effect) effect.sheet.render(true); 
    }
  
    async _OnRemoveEffect(event){
        event.preventDefault();
        const effectId = event.currentTarget.dataset.effectId;
        await this.document.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    }
    
    async _prepareContext(options){
        const context = await super._prepareContext(options);    
        context.effects = this.document.effects.contents;
        return context;
    }

    async _OnAddEffect(event){
        event.preventDefault();
        const effectData = {
        name: "new Effect",
        changes: [],
        icon: "icons/svg/aura.svg",
        origin: this.document.uuid,
        };
        await this.document.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }
  
}

class TraitSheet extends NonObjectItemsSheet{
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }
    static PARTS = {
        main : {
            template : "systems/testsystem/templates/trait-sheet.html",
            scrollable: ["", ".tab"],
        }
    }
}

class CultureSheet extends NonObjectItemsSheet{
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }
    static PARTS = {
        main : {
            template : "systems/testsystem/templates/culture-sheet.html",
            scrollable: ["", ".tab"],
        }
    }
}

class SubcultureSheet extends NonObjectItemsSheet{
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }

    static PARTS = {
        main : {
            template : "systems/testsystem/templates/subculture-sheet.html",
            scrollable: ["", ".tab"],
        }
    }

    async _prepareContext(options){
        const context = await super._prepareContext(options);    
        const allCultures = game.items.filter(i=>i.type === "Culture");
        context.cultures = allCultures;
        return context;
    }
}

class FightingSchoolSheet extends NonObjectItemsSheet{
        static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        actions:{
            addSkills: function (event, target) { this._onAddingSkill(event, target);},
            removeSkill: function (event, target) {this._onRemoveSkill(event,target);},
            changeSkillAllowed: function(event, target) {this._onChangingSkillAllowed(event, target);}
        }
    }

    static PARTS = {
        main : {
            template : "systems/testsystem/templates/fightingschool-sheet.html",
            scrollable: ["", ".tab"],
        }
    }

    constructor(...args){
        super(...args);
        this._onChangeSkillAllowedBound = this._onChangingSkillAllowed.bind(this);
    }

    async _onAddingSkill(event, target){
        event.preventDefault();
        const skillsAllowed = foundry.utils.duplicate(this.document.system.skillsAllowed ?? []);
        skillsAllowed.push("new skill");
        await this.document.update({
            "system.skillsAllowed":skillsAllowed
        });
    }

    async _onRemoveSkill(event, target){
        event.preventDefault();
        const skillsAllowed = foundry.utils.duplicate(this.document.system.skillsAllowed);
        const skillname= target.dataset.skillName;
        const index = skillsAllowed.indexOf(skillname);
        if (index !== -1) 
            skillsAllowed.splice(index, 1);
        await this.document.update({
            "system.skillsAllowed": skillsAllowed
        });
    }

    async _onChangingSkillAllowed(event){
        event.preventDefault();
        event.stopPropagation();
        const skillsAllowed = foundry.utils.duplicate(this.document.system.skillsAllowed);
        const itemIndex = Number(event.target.dataset.itemIndex);
        const newSkill = event.target.value;
        skillsAllowed[itemIndex] = newSkill;
        await this.document.update({
            "system.skillsAllowed": skillsAllowed
        });
    }
    _onRender(context, options){
        super._onRender(context, options);
        this.element.querySelectorAll('select[name="system.skillAllowed"]').forEach(sel =>
            sel.addEventListener("change", this._onChangeSkillAllowedBound)
        );
    }

}

class FightingManeuverSheet extends NonObjectItemsSheet{
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }

    static PARTS = {
        main : {
            template : "systems/testsystem/templates/fightingManeuver-sheet.html",
            scrollable: ["", ".tab"],
        }
    }

    async _prepareContext(options){
        const context = await super._prepareContext(options);    
        const allSchools = game.items.filter(i=>i.type === "Fighting School");
        context.schools = allSchools;
        return context;
    }
}

class ObjectSheet extends ObjectsItemsSheet{

    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }
    static PARTS = {
        main : {
            template : "systems/testsystem/templates/object-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class ShieldSheet extends ObjectsItemsSheet{
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }

    static PARTS = {
        main : {
            template : "systems/testsystem/templates/shield-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class ArmorSheet extends ObjectsItemsSheet{
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }

    static PARTS = {
        main : {
            template : "systems/testsystem/templates/armor-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class WeaponSheet extends ObjectsItemsSheet{
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }

    static PARTS = {
        main : {
            template : "systems/testsystem/templates/weapon-sheet.html",
            scrollable: [".object-body"],
        }
    }

     _onRender(context, options){
        super._onRender(context, options);

        this.element.querySelectorAll('select[name="system.skill"]').forEach(sel =>
            sel.addEventListener("change", this._onChangeSkillBound)
        );
    }

    constructor(...args) {
        super(...args);

        this._onChangeSkillBound = this._onChangeSkill.bind(this);
    }

    async _onChangeSkill(event){

        event.preventDefault();
		event.stopPropagation();

        const skill = event.target.value;
        await this.document.update({ "system.skill": skill });  
    }
}

class ContainerSheet extends ObjectsItemsSheet{
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form:{
            handler:this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    }

    static PARTS = {
        main : {
            template : "systems/testsystem/templates/container-sheet.html",
            scrollable: [".container-body"]
        }
    }

    constructor(...args){
        super(...args);
        this._onDropBound = this._onDropItems.bind(this);
        this._onChangeQuantityBound = this._OnChangeQuantity.bind(this);
    }

    _onRender(context, options){

        this.element.querySelectorAll('input[name*="system.quantity"]').forEach(inp =>
            inp.addEventListener("change", this._onChangeQuantityBound)
        );


        if (!this._dropListenerBound || this.isUsed) {
            this.element.addEventListener("drop", this._onDropBound);
            this.element.addEventListener("dragover", event => event.preventDefault());
            this._dropListenerBound = true;
        }
    }

    async _prepareContext(options){
        const context = await super._prepareContext(options);    
        const items = [];
        for (const uuid of this.document.system.contents ?? []) {
            const item = await fromUuid(uuid);
            if (item) items.push(item);
        }
        context.containedItems = items;

        context.objectSizes = ObjectSizes;
        context.objectSizeLabels = ObjectSizeLabels;

        return context;
    } 

    async _onDropItems(event){
        event.preventDefault();
        const dataTransfer = event.dataTransfer;
        if (!dataTransfer) return;
        const dataString = dataTransfer.getData("text/plain");
        if (!dataString) return;

        const parsed = JSON.parse(dataString);
        let item = await fromUuid(parsed.uuid);
        if(!item) return;
        if (item.uuid === this.document.uuid) return;
        if(item.system.weigth < this.document.system.weigthRemaining) return;

        if(!item.actor){
            const actor = this.document.actor;

            const itemData = item.toObject();
            itemData.system.quantity = 1;
            const [embedded] = await actor.createEmbeddedDocuments("Item", [itemData]);
            item = embedded;
        }

        if (item.actor.id !== this.document.actor.id) {
            ui.notifications.warn("Item must belong to the same actor.");
            return;
        }
        const contents = Array.from(this.document.system.contents ?? []);
        if(contents.includes(item.uuid))return;
        contents.push(item.uuid);

        await this.document.update({
            "system.contents":contents
        });
    }

    async _UpdateWeight(){
        let weigthUsed =0;
        for(const content of this.document.system.contents){
            let item = await fromUuid(content);
            weigthUsed += item.weigth;
        }
        const update = {};
        update[`system.weight`] = weigthUsed;
        update[`system.weightRemaining`] = this.document.system.weigthAllowed - weigthUsed;
        this.document.update(update);
    }

    async _OnChangeQuantity(event){
        event.preventDefault();
        const value = event.target.value;
        const id = event.target.dataset.itemId;
        const actor = this.document.actor;

        const item = actor.items.get(id);
        const baseWeight = item.system.weigth / item.system.quantity;
        const update= {};
        update[`system.quantity`] = value;
        update[`system.weight`] = baseWeight*value;
        await item.update(update);
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

Hooks.on("preCreateItem", (item, data, options, userId)=>{
    if(data.type == "Weapon" || data.type == "Fighting School" ){
        const system = data.system ?? {};
        system.skills = [];
        for(const [skill,list] of Object.entries(Fighting)){
            if (!system.skills.includes(skill)) {
                system.skills.push(skill);
            }
        }
        item.updateSource({ system });
    }		
}); 

Hooks.once("init", async ()=>{
  console.log("✅ TestSystem Init Hook");

    foundry.documents.collections.Actors.registerSheet("testsystem", PJSheet, {
        types: ["PJ"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", ObjectSheet, {
        types: ["Object"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", TraitSheet, {
        types: ["Trait"],
        makeDefault: true
    });
 
    foundry.documents.collections.Items.registerSheet("testsystem", CultureSheet, {
        types: ["Culture"],
        makeDefault: true
    });    

    foundry.documents.collections.Items.registerSheet("testsystem", SubcultureSheet, {
        types: ["Subculture"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", ShieldSheet, {
        types: ["Shield"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", ArmorSheet, {
        types: ["Armor"],
        makeDefault: true
    });
    foundry.documents.collections.Items.registerSheet("testsystem", WeaponSheet, {
        types: ["Weapon"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", FightingManeuverSheet, {
        types:["Fighting Maneuver"],
        makeDefault:true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", FightingSchoolSheet, {
        types:["Fighting School"],
        makeDefault:true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", ContainerSheet, {
        types:["Container"],
        makeDefault:true
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
Handlebars.registerHelper("toNumber", value => Number(value))
});

Handlebars.registerHelper("not", function (value) {
    return !value;
});

Hooks.on("updateActiveEffect", async (effect, changed, option, userId) =>{
if(!changed.changes) return;
const updates = [];
for (const change of effect.changes) {
    if (change.key.endsWith(".MaxValue") ) {
      const parts = change.key.split("."); 
      const statName = parts[2];       
      const basePath = parts.slice(0, -1).join(".");
      const currentKey = `${basePath}.CurrentValue`;
		
      if (statName === "Constitution") return;
		
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



