import { CATEGORYSKILLS, Social, Stealth, Crafting, Knowledge, Athletic, Restricted, Fighting } from "./data/Skills.js"
import { AttackTypes, ManeuverTypes } from "./data/Actions.js"
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
function roundTo(value, decimals = 2) {
    return Number(Math.round(value + "e" + decimals) + "e-" + decimals);
}


class PJActorAPI extends Actor {
    static async onUpdateWeight(actor) {
        const containers = actor.items.filter(i => i.type === "Container");

        let weightUsedCenti = 0;

        for (const container of containers) {
            const cleanWeight = Math.round(Number(container.system.weight ?? 0) * 100);
            weightUsedCenti += cleanWeight;
        }

        const weightUsed = weightUsedCenti / 100;

        await actor.update({
            "system.weight": weightUsed
        });
    }


    static getCurrentWeight(actor) {
        return Number(actor.system.weight ?? 0);
    }

    static getMaxWeight(actor) {
        return Number(actor.system.maxWeight ?? 0);
    }

    static getContainers(actor) {
        return actor.items.filter(i => i.type === "Container");
    }

    static async UpdateAllContainers(actor) {
        const containers = actor.items.filter(i => i.type === "Container");
        for (const container of containers) {
            await ContainerItemAPI.updateWeight(container);
        }
    }
    static async onUpdateProtectionAndBulk(actor) {
        const update = {};
        let currentBulk = 0;
        let currentProtection = 0;
        for (const value of Object.values(actor.system.equipment)) {
            currentBulk += Number(value?.bulk ?? 0);
            currentProtection += Number(value?.protection ?? 0);
        }
        update[`system.protection`] = currentProtection;
        update[`system.bulk`] = currentBulk;
        await actor.update(update);
    }

    static async onUnequipWeapon(actor) {
        const update = {};
        update[`system.equipment.Weapon`] = { "id": "", "efficiency": { "textile": 0, "fluide": 0, "solid": 0 }, "bulk": 0, "reach": 0 };
        await actor.update(update);
        await PJActorAPI.onUpdateProtectionAndBulk(actor);
    }

    static async onUnEquipArmor(target, actor) {
        const itemType = target.dataset.itemType;
        const update = {};
        update[`system.equipment.${itemType}`] = { "id": "", "protection": 0, "bulk": 0, "type": "" };
        await actor.update(update);
        await PJActorAPI.onUpdateProtectionAndBulk(actor);
    }

    static isInEquipment(itemToRemoveId, actor) {
        const equipment = actor.system.equipment;
        let typeOfItem = null;
        let isInEquipment = false;
        for (const [type, equip] of Object.entries(equipment)) {
            if (equip.id === itemToRemoveId) {
                typeOfItem = type
                isInEquipment = true;
            }
        }
        return { typeOfItem, isInEquipment };
    }

}

class PJSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "actor"],
        position: {
            width: 1000,
            height: 600,
        },
        tag: 'form',
        form: {
            handler: this.#onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            title: "Character sheet",
            resizable: true,
        },
        actions: {
            deleteTrait: this.#_onRemoveTrait,
            statRoll: this.#_onRollStat,
            skillRoll: this.#_OnRollSkill,
            printItem: this.#_OnPrintItem,
            changeTab: this._onClickTab,
            deleteItem: function (event, target) { this._onDeleteItem(event, target); },
            equipArmor: function (event, target) { this._onEquipArmor(event, target); },
            unequipArmor: function (event, target) { PJActorAPI.onUnEquipArmor(target, this.actor); },
            equipWeapon: function (event, target) { this._onEquipWeapon(event, target); },
            unequipWeapon: function (event, target) { PJActorAPI.onUnequipWeapon(this.actor); },
            attack: function (event, target) { this._onAttack(event, target); },
            rangedAttack: function (event, target) { this._onRangedAttack(event, target); },
            defense: function (event, target) { this._onDefense(event, target); },
            maneuver: function (event, target) { this._onPerformManeuver(event, target); },
            printDescription: function (event, target) { this._onPrintDescription(event, target); },
            addHighlight: function (event, target) { this._onAddHighlight(event, target); },
            removeHighlight: function (event, target) { this._onDeleteHighlight(event, target); },
        }
    }
    static PARTS = {
        form: {
            template: "systems/testsystem/templates/pj-sheet.html",
            scrollable: ["", ".tab"],
        }
    }

    tabGroups = {
        primary: 'skillsTab'
    }
    tabs = {
        skillsTab: {
            id: 'skillsTab',
            group: 'primary'
        },
        fightingTab: {
            id: 'fightingTab',
            group: 'primary'
        },
        inventoryTab: {
            id: 'inventoryTab',
            group: 'primary'
        },
        magicTab: {
            id: 'magicTab',
            group: 'primary'
        },
        historyTab: {
            id: 'historyTab',
            group: 'primary'
        }
    }

    getTabs() {
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
        this._OnChangeHighlightTypeBound = this._OnChangeHighlightType.bind(this);


        this._RomanceHighlights = [];
        this._FatefulHighlights = [];
        this._DramaticHighlights = [];
        this._FortuneHighlights = [];
        this._TragedyHighlights = [];

        this._FamilyStandings = [];
        this._ParentMishaps = [];
        this._CrucialChildhoodEvents = [];
        this._ChildhoodMemory = [];
    }

    getLifepathData() {
        this._RomanceHighlights = game.items.filter(i => i.type === "Lifepath - Romance");
        this._DramaticHighlights = game.items.filter(i => i.type === "Lifepath - Dramatic Encounter"
            && i.system.culture === this.document.system.culture);
        this._FatefulHighlights = game.items.filter(i => i.type === "Lifepath - Fateful Encounter"
            && i.system.culture === this.document.system.culture);
        this._FortuneHighlights = game.items.filter(i => i.type === "Lifepath - Stroke of Fortune"
            && i.system.culture === this.document.system.culture);
        this._TragedyHighlights = game.items.filter(i => i.type === "Lifepath - Stroke of Tragedy"
            && i.system.culture === this.document.system.culture);


        const familyStandings = game.items.filter(i => i.type === "Lifepath - Family Standing"
            && i.system.culture === this.document.system.culture);
        if (familyStandings.length > 0) this._FamilyStandings = familyStandings[0].system.possibilities;
        else this._FamilyStandings = [];

        const parentMishaps = game.items.filter(i => i.type === "Lifepath - Parent Mishaps"
            && i.system.culture === this.document.system.culture);
        if (parentMishaps.length > 0) this._ParentMishaps = parentMishaps[0].system.possibilities;
        else this._ParentMishaps = [];

        const crucialChildhoodEvent = game.items.filter(i => i.type === "Lifepath - Crucial Childhood Moment"
            && i.system.culture === this.document.system.culture);
        if (crucialChildhoodEvent.length > 0) this._CrucialChildhoodEvents = crucialChildhoodEvent[0].system.possibilities;
        else this._CrucialChildhoodEvents = [];

        const childhoodMemory = game.items.filter(i => i.type === "Lifepath - Childhood Memory"
            && i.system.culture === this.document.system.culture);
        if (childhoodMemory.length > 0) this._ChildhoodMemory = childhoodMemory[0].system.possibilities;
        else this._ChildhoodMemory = [];
    }


    static _onClickTab(event) {
        event.preventDefault();

        const target = event.target;
        const tab = target.dataset.tab;
        const group = target.closest(".tabs").dataset.group;

        this.tabGroups[group] = tab;
        this.render();
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.tabs = this.getTabs();
        context.actor = this.document;
        context.system = this.document.system;
        context.stats = this.document.system.stats;
        context.skills = this.document.system.skills;

        context.traits = this.document.items.filter(i => i.type === "Trait");
        context.containers = this.document.items.filter(i => i.type === "Container");
        context.shields = this.document.items.filter(i => i.type === "Shield");
        context.armors = this.document.items.filter(i => i.type === "Armor");
        context.weapons = this.document.items.filter(i => i.type === "Weapon");
        context.rangedWeapons = this.document.items.filter(i => i.type === "Ranged Weapon");
        context.thrownWeapons = this.document.items.filter(i => i.type === "Thrown Weapon");
        context.fightingManeuvers = this.document.items.filter(i => i.type === "Fighting Maneuver");
        context.ammunitions = this.document.items.filter(i => i.type === "Ammunition");
        const maneuversBySchool = {};

        for (const m of context.fightingManeuvers) {
            const school = m.system.school || "Other";
            if (!maneuversBySchool[school]) {
                maneuversBySchool[school] = [];
            }
            maneuversBySchool[school].push(m);
        }

        context.fightingManeuversBySchool = Object.entries(maneuversBySchool).map(
            ([school, maneuvers]) => ({
                school,
                maneuvers
            })
        );


        context.protection = this.document.system.protection;
        context.bulk = this.document.system.bulk;

        const allCultures = game.items.filter(i => i.type === "Culture");
        const allSubcultures = game.items.filter(i => i.type === "Subculture");

        context.cultures = allCultures;
        context.subcultures = allSubcultures.filter(i => i.system.parentCulture === context.system.culture)

        context.catalystSpells = this.document.items.filter(i => i.type === "Spell" && i.system.spellType === "Catalysme");
        context.runesmithSpells = this.document.items.filter(i => i.type === "Spell" && i.system.spellType === "Forgerune");
        context.thaumarturgeSpells = this.document.items.filter(i => i.type === "Spell" && i.system.spellType === "Thaumaturgie");
        context.wordsOfPowerSpells = this.document.items.filter(i => i.type === "Spell" && i.system.spellType === "WordsOfPower");

        this.getLifepathData();

        context.familyStandings = this._FamilyStandings;
        context.parentMishaps = this._ParentMishaps;
        context.crucialChildhoodEvents = this._CrucialChildhoodEvents;
        context.childhoodMemory = this._ChildhoodMemory;

        const highlightOptionsByType = {
            "Romance": this._RomanceHighlights.flatMap(i => i.system.possibilities),
            "Fateful Encounter": this._FatefulHighlights.flatMap(i => i.system.possibilities),
            "Stroke of Fortune": this._FortuneHighlights.flatMap(i => i.system.possibilities),
            "Dramatic Encounter": this._DramaticHighlights.flatMap(i => i.system.possibilities),
            "Stroke of Tragedy": this._TragedyHighlights.flatMap(i => i.system.possibilities)
        };

        context.highlights = context.system.background.highlights.map(h => {
            return {
                ...h,
                availablePossibilities: highlightOptionsByType[h.type] ?? []
            };
        });

        context.maneuverTypes = Object.values(ManeuverTypes).map(k => ({
            key: k,
            label: k.charAt(0).toUpperCase() + k.slice(1)
        }));

        return context;
    }
    _onRender(context, options) {
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

        this.element.querySelectorAll('select[name*="system.background.highlights"]').forEach(sel =>
            sel.addEventListener("change", this._OnChangeHighlightTypeBound)
        );

        if (!this._dropListenerBound) {
            this.element.addEventListener("drop", this._onDropBound);
            this.element.addEventListener("dragover", event => event.preventDefault());
            this._dropListenerBound = true;
        }
    }

    static async #onSubmitForm(event, form, formData) {
        if (event.target.dataset.noSubmit !== undefined) return;
        event.preventDefault()
        const name = event.target.name;
        let value = event.target.value;
        if (value === "true") value = true;
        else if (value === "false") value = false;
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
        if (!item) return;
        itemData = {
            name: item.name || "Unnamed Item",
            type: item.type,
            system: item.system || {}
        };
        if ("weight" in itemData.system) {
            itemData.system.quantity = 1;
            if (itemData.type === "Container") {
                itemData.system.isUsed = true;
                await this.document.createEmbeddedDocuments("Item", [itemData]);
            }
        }
        else {
            await this.document.createEmbeddedDocuments("Item", [itemData]);
        }
    }

    async _onDeleteItem(event, target) {
        event.preventDefault();
        const actor = this.actor;
        const itemToRemoveId = target.dataset.itemId;
        const item = this.document.items.get(itemToRemoveId).toObject();
        if (item.type === "Container") {
            for (const element of item.system.contents) {
                const elementId = element.uuid.split(".")[3];
                if (PJActorAPI.isInEquipment(elementId, actor)) {
                    const elementToRemove = await fromUuid(element.uuid);
                    if (elementToRemove.type === "Weapon") {
                        await PJActorAPI.onUnequipWeapon(actor);
                    }
                    else if (elementToRemove.type === "Shield" || elementToRemove.type === "Armor") {
                        target.dataset.itemType = elementToRemove.type;
                        await PJActorAPI.onUnEquipArmor(target, actor);
                    }
                }
                await this.document.deleteEmbeddedDocuments("Item", [elementId]);
            }
        }

        await this.document.deleteEmbeddedDocuments("Item", [itemToRemoveId]);
        await PJActorAPI.onUpdateWeight(this.actor);
    }

    async _onEquipArmor(event, target) {
        event.preventDefault();
        const itemType = target.dataset.itemType;
        const itemId = target.dataset.itemId;
        const object = this.document.items.get(itemId).toObject();
        const update = {};
        update[`system.equipment.${itemType}.id`] = itemId;
        update[`system.equipment.${itemType}.protection`] = object.system.protection;
        update[`system.equipment.${itemType}.bulk`] = object.system.bulk;
        update[`system.equipment.${itemType}.type`] = object.system.type;
        await this.document.update(update);
        await PJActorAPI.onUpdateProtectionAndBulk(this.actor);
    }

    async _onEquipWeapon(event, target) {
        event.preventDefault();
        const itemId = target.dataset.itemId;
        const object = this.document.items.get(itemId).toObject();
        const update = {};
        update[`system.equipment.Weapon.id`] = itemId;
        update[`system.equipment.Weapon.efficiency`] = object.system.efficiency;
        update[`system.equipment.Weapon.bulk`] = object.system.bulk;
        update[`system.equipment.Weapon.type`] = object.system.type;
        update[`system.equipment.Weapon.reach`] = object.system.reach;
        update[`system.equipment.Weapon.skill`] = object.system.skill;
        await this.document.update(update);
        await PJActorAPI.onUpdateProtectionAndBulk(this.actor);
    }

    async _OnChangeHighlightType(event) {
        event.preventDefault();
        const itemIndex = event.target.dataset.itemIndex;
        const field = event.target.dataset.highlightField;
        const value = event.target.value;

        const highlights = Array.from(this.document.system.background.highlights);
        if (field === "type") {
            highlights[itemIndex].type = value;
        }
        else if (field === "value") {
            highlights[itemIndex].value = value;
        }

        const update = {}
        update[`system.background.highlights`] = highlights;
        await this.document.update(update);
        this.render(false);
    }

    _onAttack(event, target) {
        event.preventDefault();
        const skillKey = target.dataset.itemSkillkey;

        const content = `
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
            buttons: {
                roll: {
                    label: "Roll",
                    callback: html => this._onConfirmAttack(html, skillKey)
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);
    }

    _onRangedAttack(event, target) {
        event.preventDefault();
        const skillKey = target.dataset.itemSkillkey;
        const ammunitions = this.document.items.filter(i => i.type === "Ammunition" && i.system.quantity > 0);
        const options = ammunitions
            .map((ammo) =>
                `<option value="${ammo.id}">${ammo.name}</option>`
            ).
            join("");
        const content = `
        <form class = "difficulty-Modifier-form">
            <div class="difficulty-Modifier-group">

                <label>Modifier</label>
                <input type="number" name="modifier" value="0">
                <h4>Distance</h4>
                <div class="radio-line">
                    <input type="radio" name="distance" value="less-quart-max-distance">
                    <label>Less than 0.25 of max distance</label>
                </div>
                <div class="radio-line">
                    <input type="radio" name="distance" value="btw-quart-and-half-max-distance">
                    <label>Between 0.25 and 0.5</label>
                </div>
                <div class="radio-line">
                    <input type="radio" name="distance" value="btw-half-threequart-max-distance">
                    <label>Between 0.5 and 0.75</label>
                </div>
                <div class="radio-line">
                    <input type="radio" name="distance" value="more-threequart-max-distance">
                    <label>More than 0.75</label>
                </div>
                <h4>Obstruction</h4>
                <div class="radio-line">
                    <input type="radio" name="obstruction" value="line-obstructed">
                    <label>Line obstructed</label>
                </div>
                <h4>Armor efficiency</h4>
                <div class="radio-line">
                    <input type="radio" name="efficiency" value="bad-efficiency">
                    <label>-1</label>
                </div>
                <div class="radio-line">
                    <input type="radio" name="efficiency" value="normal-efficiency">
                    <label>0</label>
                </div>
                <div class="radio-line">
                    <input type="radio" name="efficiency" value="good-efficiency">
                    <label>+1</label>
                </div>
            </div>
            <div class = "ammunition-type">
                    <label>Ammunition to use</label>
                    <select id="ammunition-select" name="ammunitionType">
                        ${options}
                    </select>
            </div>
        </form>
        `;
        new Dialog({
            title: `${skillKey} roll`,
            content,
            buttons: {
                roll: {
                    label: "Roll",
                    callback: async html => {
                        const form = html[0].querySelector("form");
                        const ammunitionId = form.ammunitionType.value;
                        if (ammunitionId) {
                            const ammunitionItem = this.document.items.get(ammunitionId);
                            const baseWeight = Number(ammunitionItem.system.weight) / ammunitionItem.system.quantity;

                            const newAmmunitionUsedQuantity = ammunitionItem.system.quantity - 1;
                            const update = {};
                            update[`system.quantity`] = newAmmunitionUsedQuantity;
                            update[`system.weight`] = baseWeight * newAmmunitionUsedQuantity;
                            await ammunitionItem.update(update);
                            PJActorAPI.UpdateAllContainers(this.document);
                        }

                        const modifiers = {
                            "less-quart-max-distance": 1,
                            "btw-half-threequart-max-distance": 0,
                            "btw-half-threequart-max-distance": -1,
                            "more-threequart-max-distance": -2,
                            "line-obstructed": -1,
                            "bad-efficiency": -1,
                            "normal-efficiency": 0,
                            "good-efficiency": 1
                        };

                        let extraModifier = 0;

                        const distance = form.querySelector('input[name="distance"]:checked')?.value;
                        const obstruction = form.querySelector('input[name="obstruction"]:checked')?.value;
                        const efficiency = form.querySelector('input[name="efficiency"]:checked')?.value;

                        if (distance) {
                            extraModifier += modifiers[distance] || 0;
                        }

                        if (obstruction) {
                            extraModifier += modifiers[obstruction] || 0;
                        }

                        if (efficiency) {
                            extraModifier += modifiers[efficiency] || 0;
                        }

                        form.modifier.value = Number(form.modifier.value) + extraModifier;
                        this._onConfirmAttack(html, skillKey);
                    }
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }, {
            width: 533.555,
            height: 435.778,
            resizable: true
        }).render(true);
    }

    _onThrownAttack(event, target) {
        event.preventDefault();
        const skillKey = target.dataset.itemSkillkey;
        const content = `
        <form class = "difficulty-Modifier-form">
            <div class="difficulty-Modifier-group">
                <label>Modifier</label>
                <input type="number" name="modifier" value="0">
                <h4>Distance</h4>
                <div class="radio-line">
                    <input type="radio" name="distance" value="less-quart-max-distance">
                    <label>Less than 0.25 of max distance</label>
                </div>
                <div class="radio-line">
                    <input type="radio" name="distance" value="btw-quart-and-half-max-distance">
                    <label>Between 0.25 and 0.5</label>
                </div>
                <div class="radio-line">
                    <input type="radio" name="distance" value="btw-half-threequart-max-distance">
                    <label>Between 0.5 and 0.75</label>
                </div>
                <div class="radio-line">
                    <input type="radio" name="distance" value="more-threequart-max-distance">
                    <label>More than 0.75</label>
                </div>
                <h4>Obstruction</h4>
                <div class="radio-line">
                    <input type="radio" name="obstruction" value="line-obstructed">
                    <label>Line obstructed</label>
                </div>
            </div>
        </form>
        `;
        new Dialog({
            title: `${skillKey} roll`,
            content,
            buttons: {
                roll: {
                    label: "Roll",
                    callback: async html => {
                        const form = html[0].querySelector("form");
                        const modifiers = {
                            "less-quart-max-distance": 1,
                            "btw-half-threequart-max-distance": 0,
                            "btw-half-threequart-max-distance": -1,
                            "more-threequart-max-distance": -2,
                            "line-obstructed": -1,
                        };

                        let extraModifier = 0;

                        const distance = form.querySelector('input[name="distance"]:checked')?.value;
                        const obstruction = form.querySelector('input[name="obstruction"]:checked')?.value;

                        if (distance) {
                            extraModifier += modifiers[distance] || 0;
                        }

                        if (obstruction) {
                            extraModifier += modifiers[obstruction] || 0;
                        }

                        form.modifier.value = Number(form.modifier.value) + extraModifier;
                        this._onConfirmAttack(html, skillKey);
                    }
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }, {
            width: 533.555,
            height: 435.778,
            resizable: true
        }).render(true);
    }



    async _onConfirmAttack(html, skillKey) {
        const statsSkill = this.document.system.skills["Fighting"][skillKey].stats;
        const skillLevel = this.document.system.skills["Fighting"][skillKey].level;
        const values = statsSkill.map(s => this.document.system.stats[s].CurrentValue || 0);
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        const form = html[0].querySelector("form");
        const levelModifierValue = skillLevel * 5;
        const modifier = 10 * (Number(form.modifier.value) || 0);

        const statDetails = statsSkill.map(s => {
            const val = this.document.system.stats[s]?.CurrentValue ?? 0;
            return `${s}(${val})`;
        }).join(" + ");

        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate();
        const valueRolled = roll.total;
        const valueTested = clamp(average + modifier + levelModifierValue, 5, 95);
        const test = valueTested >= valueRolled;
        const testSign = Math.sign(valueTested - valueRolled);
        const testDegree = testSign * Math.floor(Math.abs(valueTested - valueRolled) / 10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-skill-roll">
        <h3>Attack roll: ${skillKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>${statDetails}</p>
        <p>Modifiers: ${modifier}</p>
        <p>Level: ${skillLevel} (+ ${levelModifierValue}%)</p>
        <p>Success Degree: ${testDegree} </p>
        </div>
        `;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: message,
            rolls: [roll],
        })
    }

    _onDefense(event, target) {
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
            buttons: {
                roll: {
                    label: "Roll",
                    callback: html => this._onConfirmDefense(html, skillKey)
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);
    }

    async _onConfirmDefense(html, skillKey) {
        const statsSkill = this.document.system.skills["Fighting"][skillKey].stats;
        const skillLevel = this.document.system.skills["Fighting"][skillKey].level;
        const values = statsSkill.map(s => this.document.system.stats[s].CurrentValue || 0);
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        const form = html[0].querySelector("form");
        const levelModifierValue = skillLevel * 5;
        const modifier = 10 * (Number(form.modifier.value) || 0);

        const statDetails = statsSkill.map(s => {
            const val = this.document.system.stats[s]?.CurrentValue ?? 0;
            return `${s}(${val})`;
        }).join(" + ");

        let protectionBaseValue = Number(this.document.system.equipment.Armor.protection);
        const attackType = form.attackType.value;
        const attackTypeNumber = Number(attackType);
        let attackTypeLabel = "";
        switch (attackTypeNumber) {
            case AttackTypes.INNEFICIENT:
                protectionBaseValue *= 2;
                attackTypeLabel = "Inneficient attack";
                break;
            case AttackTypes.CLASSIC:
                attackTypeLabel = "Classic attack";
                break;
            case AttackTypes.EFFICIENT:
                attackTypeLabel = "Efficient attack";
                protectionBaseValue /= 2;
                break;
            case AttackTypes.VERY_EFFICIENT:
                attackTypeLabel = "Very efficient attack";
                protectionBaseValue = 0;
                break;

        }
        const TotalProtection = protectionBaseValue + Number(this.document.system.equipment.Shield.protection);
        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate();
        const valueRolled = roll.total - TotalProtection;
        const valueTested = clamp(average + modifier + levelModifierValue, 5, 95);
        const test = valueTested >= valueRolled;
        const testSign = Math.sign(valueTested - valueRolled);
        const testDegree = testSign * Math.floor(Math.abs(valueTested - valueRolled) / 10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-skill-roll">
        <h3>Defense roll: ${skillKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>${statDetails}</p>
        <p>Modifiers:${modifier}</p>
        <p>Level: ${skillLevel} (+ ${levelModifierValue}%)</p>
        <p>Protection:${TotalProtection} ( ${attackTypeLabel} )
        <p>Success Degree: ${testDegree} </p>
        </div>
        `;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: message,
            rolls: [roll],
        })
    }

    _onPerformManeuver(event, target) {
        const weaponLinked = this.document.system.equipment.Weapon;
        const maneuverId = target.dataset.itemId;
        const maneuver = this.document.items.get(maneuverId);
        const schoolOfManeuver = game.items.filter(i => i.type === "Fighting School" && i.name === maneuver.system.school)[0];

        if (weaponLinked.id.length === 0) return;
        const weaponSkill = weaponLinked.skill;
        target.dataset.itemSkillkey = weaponSkill;
        let content;
        if (schoolOfManeuver.system.skillsAllowed.includes(weaponSkill)) {
            content = `
        <form class = "maneuver-roll-confirmation-form">
        </form>
        `;
        }
        else {
            content = `
        <form class = "maneuver-roll-confirmation-form">
            <div class = "maneuver-roll-confirmation-group" >
                <label>Your weapon is not appropriate for this kind of maneuver. Are you certain you want to try it?</label>
            </div>
        </form>
        `;
        }
        new Dialog({
            title: `Confirmation`,
            content,
            buttons: {
                rollAttack: {
                    label: "Roll Attack",
                    callback: html => this._onAttack(event, target)
                },
                rollDefense: {
                    label: "Roll Defense",
                    callback: html => this._onDefense(event, target)
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);

    }

    async _onChangeStat(event) {
        event.preventDefault();
        event.stopPropagation();

        const input = event.target;
        const statKey = input.name.split(".")[2];
        const newValue = Number(input.value);
        const update = {};

        if (input.name?.endsWith(".MaxValue")) {
            update[`system.stats.${statKey}.MaxValue`] = newValue;
            update[`system.stats.${statKey}.CurrentValue`] = newValue;
            if (statKey === "Strength") {
                update[`system.maxWeight`] = Number(newValue / 2);
            }
        }
        else if (input.name?.endsWith(".CurrentValue")) {
            if (statKey === "Constitution") {
                const currentValue = this.document.system.stats[statKey].CurrentValue;
                const maxValue = this.document.system.stats[statKey].MaxValue;
                const MaxValueStrength = this.document.system.stats["Strength"].MaxValue;
                const MaxValueAgility = this.document.system.stats["Agility"].MaxValue;

                if (newValue > maxValue * 0.75) {
                    update[`system.stats.${"Agility"}.CurrentValue`] = MaxValueAgility;
                    update[`system.stats.${"Strength"}.CurrentValue`] = MaxValueStrength;
                }
                if (newValue <= maxValue * 0.75 && newValue > maxValue * 0.5) {
                    update[`system.stats.${"Agility"}.CurrentValue`] = MaxValueAgility - 10;
                }
                else if (newValue <= maxValue * 0.5 && newValue > maxValue * 0.25) {
                    update[`system.stats.${"Strength"}.CurrentValue`] = MaxValueStrength - 10;
                }
                else if (newValue <= maxValue * 0.25 && newValue >= 0) {
                    update[`system.stats.${"Agility"}.CurrentValue`] = MaxValueAgility - 20;
                    update[`system.stats.${"Strength"}.CurrentValue`] = MaxValueStrength - 20;
                }
                update[`system.stats.${statKey}.CurrentValue`] = newValue;
            }
        }
        await this.document.update(update);
    }

    async _onChangeSkills(event) {
        event.preventDefault();
        event.stopPropagation();

        const input = event.target;
        const update = {};
        if (input.name?.endsWith(".level")) {
            const categoryKey = input.name.split(".")[2];
            const skillKey = input.name.split(".")[3];
            const newValue = Number(input.value);
            update[`system.skills.${categoryKey}.${skillKey}.level`] = newValue;
        }
        await this.actor.update(update);
    }

    static async #_onRemoveTrait(event, target, sheet) {
        event.preventDefault();
        const traitToRemoveId = target.dataset.traitId;
        await this.document.deleteEmbeddedDocuments("Item", [traitToRemoveId]);
    }

    async _onChangeCulture(event) {
        event.preventDefault();
        event.stopPropagation();

        const culture = event.target.value;
        const existingCultures = this.document.items.filter(i => i.type === "Culture");
        const existingSubCulture = this.document.items.filter(i => i.type === "Subculture");
        if (existingCultures.length > 0) {
            await this.document.deleteEmbeddedDocuments("Item", existingCultures.map(i => i.id));
        }
        if (existingSubCulture.length > 0) {
            await this.document.deleteEmbeddedDocuments("Item", existingSubCulture.map(i => i.id));
        }

        if (culture.length > 0) {
            const cultureItem = game.items.find(i => i.name === culture).toObject();
            await this.document.createEmbeddedDocuments("Item", [cultureItem]);
        }

        await this.document.update({ "system.culture": culture });

        const root = this.element;
        const subSelect = root.querySelector('select[name="system.subculture"]');

        const allSubcultures = game.items.filter(i => i.type === "Subculture");
        const subcultures = allSubcultures.filter(s => s.system.parentCulture === culture);
        subSelect.innerHTML = `<option value="">-- Sélectionne une sous-culture --</option>`;

        for (const s of subcultures) {
            const opt = document.createElement("option");
            opt.value = s.name;
            opt.textContent = s.name;
            subSelect.appendChild(opt);
        }

        this.getLifepathData();
    }

    async _onChangeSubCulture(event) {
        event.preventDefault();
        event.stopPropagation();

        const subCulture = event.target.value;
        const existingSubCulture = this.document.items.filter(i => i.type === "Subculture");
        if (existingSubCulture.length > 0) {
            await this.document.deleteEmbeddedDocuments("Item", existingSubCulture.map(i => i.id));
        }
        if (subCulture.length > 0) {
            const cultureItem = game.items.find(i => i.name === subCulture).toObject();
            await this.document.createEmbeddedDocuments("Item", [cultureItem]);
        }
        await this.document.update({ "system.subculture": subCulture });
    }

    async _OnModifyManeuverWeaponLinked(event) {
        event.preventDefault();
        event.stopPropagation();
        const value = event.target.value;
        const itemId = event.target.dataset.itemId;
        const item = this.document.items.get(itemId);
        if (!item) return;
        const update = {};
        update[`system.weaponLinked`] = value;
        await item.update(update);
    }

    async _OnModifyManeuverType(event) {
        event.preventDefault();
        event.stopPropagation();
        const value = event.target.value;
        const itemId = event.target.dataset.itemId;
        const item = this.document.items.get(itemId);
        if (!item) return;
        const update = {};
        update[`system.maneuverType`] = value;
        await item.update(update);
    }

    static async #_OnPrintItem(event, target) {
        event.preventDefault();

        const itemId = target.dataset.itemId;
        const itemDoc = this.document.items.get(itemId);
        itemDoc.sheet.render(true);
    }

    static async #_onRollStat(event, target) {
        event.preventDefault();
        const statKey = target.dataset.stat;
        const stat = this.document.system.stats[statKey];
        if (!stat) return;

        const content = `
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
            buttons: {
                roll: {
                    label: "Roll",
                    callback: html => this._onConfirmRollStat(html, statKey)
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);
    }

    async _onConfirmRollStat(html, statKey) {
        const stat = this.document.system.stats[statKey];
        const currentValueStat = stat.CurrentValue;

        const form = html[0].querySelector("form");
        const modifier = 10 * (Number(form.modifier.value) || 0);

        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate();
        const valueRolled = roll.total;
        const valueTested = clamp(currentValueStat + modifier, 5, 95);
        const test = valueTested >= valueRolled;
        const testDegree = Math.floor((valueTested - valueRolled) / 10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-stat-roll">
        <h3>Stat roll: ${statKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>Modifier: ${modifier}</p>
        <p>Success Degree: ${testDegree} </p>
        </div>
        `;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: message,
            rolls: [roll],
        })

        if (test) {
            ui.notifications.info(`il se passe des trucs`);
        }
        else {
            ui.notifications.info(`il se passe rien`);
        }
    }

    static async #_OnRollSkill(event, target) {
        event.preventDefault();
        const skillKey = target.dataset.skillkey;
        const skillCategory = target.dataset.category;

        const content = `
        <form class = "difficulty-Modifier-form">
            <div clas<ps = "difficulty-Modifier-group" >
                <label>Modifier</label>
                <input type = number name = "modifier" value="0">
            </div>
        </form>
        `;
        new Dialog({
            title: `${skillKey} roll`,
            content,
            buttons: {
                roll: {
                    label: "Roll",
                    callback: html => this._onConfirmRollSkill(html, skillKey, skillCategory)
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);
    }

    async _onConfirmRollSkill(html, skillKey, skillCategory) {
        const statsSkill = this.document.system.skills[skillCategory][skillKey].stats;
        const skillLevel = this.document.system.skills[skillCategory][skillKey].level;
        const values = statsSkill.map(s => this.document.system.stats[s].CurrentValue || 0);
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        const form = html[0].querySelector("form");
        const levelModifierValue = skillLevel * 5;
        const modifier = 10 * (Number(form.modifier.value) || 0);

        const statDetails = statsSkill.map(s => {
            const val = this.document.system.stats[s]?.CurrentValue ?? 0;
            return `${s}(${val})`;
        }).join(" + ");

        const formula = `1d100`;
        const roll = new Roll(formula);
        await roll.evaluate();
        const valueRolled = roll.total;
        const valueTested = clamp(average + modifier + levelModifierValue, 5, 95);
        const test = valueTested >= valueRolled;
        const testSign = Math.sign(valueTested - valueRolled);
        const testDegree = testSign * Math.floor(Math.abs(valueTested - valueRolled) / 10);
        const stringResponse = test ? "Success" : "Failure";

        const message = `
        <div class= "custom-skill-roll">
        <h3>Skill roll: ${skillKey}</h3>
        <p>${valueRolled} / ${valueTested}: ${stringResponse}</p>
        <p>${statDetails}</p>
        <p>Modifier: ${modifier}</p>
        <p>Level: ${skillLevel} (+ ${levelModifierValue}%)</p>
        <p>Success Degree: ${testDegree} </p>
        </div>
        `;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: message,
            rolls: [roll],
        })

        if (test) {
            ui.notifications.info(`il se passe des trucs`);
        }
        else {
            ui.notifications.info(`il se passe rien`);
        }
    }

    async _onPrintDescription(event, target) {
        event.preventDefault();
        const itemId = target.dataset.itemId;
        const item = this.document.items.get(itemId);
        const message = `
        <div class= "spell-description">
        <h3>Spell description: ${item.name}</h3>
        <p>${item.system.description}</p>
        </div>
        `;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: message,
        })
    }

    async _onAddHighlight(event, target) {
        event.preventDefault();
        const newHighlight = { type: "", value: "" };
        const highlights = Array.from(this.document.system.background.highlights);
        highlights.push(newHighlight);
        const update = {};
        update[`system.background.highlights`] = highlights;
        await this.document.update(update);
    }

    async _onDeleteHighlight(event, target) {
        event.preventDefault();
        const index = target.dataset.itemIndex;
        const highlights = Array.from(this.document.system.background.highlights);
        highlights.splice(index, 1);
        const update = {};
        update[`system.background.highlights`] = highlights;
        await this.document.update(update);
    }

    _onClose(options) {
        this._dropListenerBound = false;
    }
}

class InfoSheet extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.DocumentSheetV2) {

    static DEFAULT_SUBJECT = "item";

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.system = this.document.system;
        context.item = this.document;

        return context;
    }
}

class ObjectsItemsSheet extends InfoSheet {

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.objectSizes = ObjectSizes;
        context.objectSizeLabels = ObjectSizeLabels;

        return context;
    }

    static async onSubmitForm(event, form, formData) {
        event.preventDefault()
        const name = event.target.name;
        let value;
        if (name === "system.size" || name === "system.maxSize") {
            value = Number(event.target.value);
        }
        else {
            value = event.target.value;
        }
        const update = {};
        update[name] = value;
        await this.document.update(update);
    }
}

class NonObjectItemsSheet extends InfoSheet {

    _onRender(context, options) {
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
        if (event.target.type == "checkbox") {
            value = event.target.checked;
        }
        else {
            value = event.target.value;
        }
        const update = {};
        update[name] = value;
        await this.document.update(update);
    }

    async _OnEditEffect(event) {
        event.preventDefault();
        const effectId = event.currentTarget.dataset.effectId;
        const effect = this.document.effects.get(effectId);
        if (effect) effect.sheet.render(true);
    }

    async _OnRemoveEffect(event) {
        event.preventDefault();
        const effectId = event.currentTarget.dataset.effectId;
        await this.document.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.effects = this.document.effects.contents;
        return context;
    }

    async _OnAddEffect(event) {
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

class TraitSheet extends NonObjectItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/trait-sheet.html",
            scrollable: ["", ".tab"],
        }
    }
}

class CultureSheet extends NonObjectItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/culture-sheet.html",
            scrollable: ["", ".tab"],
        }
    }
}

class SubcultureSheet extends NonObjectItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/subculture-sheet.html",
            scrollable: ["", ".tab"],
        }
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const allCultures = game.items.filter(i => i.type === "Culture");
        context.cultures = allCultures;
        return context;
    }
}

class FightingSchoolSheet extends NonObjectItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        actions: {
            addSkills: function (event, target) { this._onAddingSkill(event, target); },
            removeSkill: function (event, target) { this._onRemoveSkill(event, target); },
            changeSkillAllowed: function (event, target) { this._onChangingSkillAllowed(event, target); }
        },
        window: {
            resizable: true
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/fightingschool-sheet.html",
            scrollable: ["", ".tab"],
        }
    }

    constructor(...args) {
        super(...args);
        this._onChangeSkillAllowedBound = this._onChangingSkillAllowed.bind(this);
    }

    async _onAddingSkill(event, target) {
        event.preventDefault();
        const skillsAllowed = foundry.utils.duplicate(this.document.system.skillsAllowed ?? []);
        skillsAllowed.push("new skill");
        await this.document.update({
            "system.skillsAllowed": skillsAllowed
        });
    }

    async _onRemoveSkill(event, target) {
        event.preventDefault();
        const skillsAllowed = foundry.utils.duplicate(this.document.system.skillsAllowed);
        const skillname = target.dataset.skillName;
        const index = skillsAllowed.indexOf(skillname);
        if (index !== -1)
            skillsAllowed.splice(index, 1);
        await this.document.update({
            "system.skillsAllowed": skillsAllowed
        });
    }

    async _onChangingSkillAllowed(event) {
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
    _onRender(context, options) {
        super._onRender(context, options);
        this.element.querySelectorAll('select[name="system.skillAllowed"]').forEach(sel =>
            sel.addEventListener("change", this._onChangeSkillAllowedBound)
        );
    }

}

class FightingManeuverSheet extends NonObjectItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/fightingManeuver-sheet.html",
            scrollable: ["", ".tab"],
        }
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const allSchools = game.items.filter(i => i.type === "Fighting School");
        context.schools = allSchools;
        return context;
    }
}

class ObjectSheet extends ObjectsItemsSheet {

    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/object-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class AmmunitionSheet extends ObjectsItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/ammunition-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class ShieldSheet extends ObjectsItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/shield-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class ArmorSheet extends ObjectsItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/armor-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class WeaponSheet extends ObjectsItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/weapon-sheet.html",
            scrollable: [".object-body"],
        }
    }

    _onRender(context, options) {
        super._onRender(context, options);

        this.element.querySelectorAll('select[name="system.skill"]').forEach(sel =>
            sel.addEventListener("change", this._onChangeSkillBound)
        );
    }

    constructor(...args) {
        super(...args);

        this._onChangeSkillBound = this._onChangeSkill.bind(this);
    }

    async _onChangeSkill(event) {

        event.preventDefault();
        event.stopPropagation();

        const skill = event.target.value;
        await this.document.update({ "system.skill": skill });
    }
}

class RangedWeaponSheet extends WeaponSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/weapon-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class ThrownWeaponSheet extends WeaponSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/thrownWeapon-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class ContainerItemAPI extends Item {
    static async updateWeight(container) {
        let weightUsed = 0;
        for (const content of container.system.contents) {
            let item = await fromUuid(content.uuid);
            weightUsed += Number(item.system.weight);
        }
        const update = {};
        update[`system.weight`] = weightUsed;
        update[`system.weightRemaining`] = Number(container.system.weightAllowed - weightUsed);
        await container.update(update);
    }


}

class ContainerSheet extends ObjectsItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        actions: {
            deleteItem: function (event, target) { this._onDeleteItem(event, target); },
            transferItem: function (event, target) { this._onTransfertItem(event, target); },
            printItem: this.#_OnPrintItem,
            addVoidItem: function (event, target) { this._OnAddVoidItem(event, target); }

        },
        window: {
            resizable: true,
        }
    }

    static PARTS = {
        main: {
            template: "systems/testsystem/templates/container-sheet.html",
            scrollable: [".container-body"]
        }
    }

    constructor(...args) {
        super(...args);
        this._onDropBound = this._onDropItems.bind(this);
        this._onChangeQuantityBound = this._OnChangeQuantity.bind(this);
        this._onChangeWeightAllowedBound = this._onChangeWeightAllowed.bind(this);

    }

    _onRender(context, options) {

        this.element.querySelectorAll('input[name*="system.quantity"]').forEach(inp =>
            inp.addEventListener("change", this._onChangeQuantityBound)
        );

        this.element.querySelectorAll('input[name*="system.weightAllowed"]').forEach(inp =>
            inp.addEventListener("change", this._onChangeWeightAllowedBound)
        );


        if (!this._dropListenerBound || this.document.system.isUsed) {
            this.element.addEventListener("drop", this._onDropBound);
            this.element.addEventListener("dragover", event => event.preventDefault());
            this._dropListenerBound = true;
        }
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const items = [];
        for (const object of this.document.system.contents ?? []) {
            const item = await fromUuid(object.uuid);
            if (item) items.push(item);
        }
        context.containedItems = items;

        context.objectSizes = ObjectSizes;
        context.objectSizeLabels = ObjectSizeLabels;

        return context;
    }

    async _onDropItems(event) {
        event.preventDefault();
        const dataTransfer = event.dataTransfer;
        if (!dataTransfer) return;
        const dataString = dataTransfer.getData("text/plain");
        if (!dataString) return;

        const parsed = JSON.parse(dataString);
        const actor = this.document.actor;
        let item = await fromUuid(parsed.uuid);
        if (!item) return;
        if (item.uuid === this.document.uuid) return;
        if (Number(PJActorAPI.getCurrentWeight(actor)) + Number(item.system.weight) > Number(PJActorAPI.getMaxWeight(actor))) return;
        if (Number(item.system.weight) > this.document.system.weightRemaining) return;
        if (item.system.size > this.document.system.maxSize) return;
        const existingItem = this.document.system.contents.find(i => i.name === item.name);
        if (existingItem) {
            const itemAlreadyPresent = await fromUuid(existingItem.uuid)
            const update = {};
            const newQuantity = itemAlreadyPresent.system.quantity + 1;
            const baseWeight = Number(itemAlreadyPresent.system.baseWeight ?? item.system.weight);

            update[`system.quantity`] = newQuantity;
            update[`system.baseWeight`] = baseWeight;
            update[`system.weight`] = Math.round((baseWeight * newQuantity) * 100) / 100;
            await itemAlreadyPresent.update(update);
        }
        else {
            if (!item.actor) {
                const itemData = item.toObject();
                const cleanWeight = Math.round(Number(itemData.system.weight) * 100) / 100;

                itemData.system.quantity = 1;
                itemData.system.baseWeight = cleanWeight;
                itemData.system.weight = cleanWeight;
                const [embedded] = await actor.createEmbeddedDocuments("Item", [itemData]);
                item = embedded;
            }
            else {

            }
            const contents = Array.from(this.document.system.contents ?? []);
            const objectToPush = { "name": item.name, "uuid": item.uuid };
            contents.push(objectToPush);

            await this.document.update({
                "system.contents": contents
            });
        }

        await this.UpdateWeight();
        await PJActorAPI.onUpdateWeight(actor);
    }

    async _OnAddVoidItem(event, target) {

        const objectTypes = ["Object", "Weapon", "Armor", "Shield"];

        const options = objectTypes
            .map(type => `<option value="${type}">${type}</option>`)
            .join("");

        const content =
            `<form>
            <form class="form-group">
                <div class = "addvoid-item-group">
                    <label>Type</label>
                    <select id="addvoid-item" name="addvoidItem">
                        ${options}
                    </select>
                </div>
            </form>
        </form>`;
        new Dialog({
            title: `$Create void`,
            content,
            buttons: {
                roll: {
                    label: "create",
                    callback: html => this._onConfirmAddVoidItem(html)
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);
    }

    async _onConfirmAddVoidItem(html) {
        const select = html[0].querySelector('select[name="addvoidItem"]');
        const value = select?.value;
        const actor = this.document.actor;

        let itemData;
        switch (value) {
            case "Weapon":
                itemData = {
                    "traits": "",
                    "efficiency": { "textile": 0, "fluide": 0, "solid": 0 },
                    "weight": 0,
                    "bulk": 0,
                    "hands": 1,
                    "reach": 0,
                    "cost": "",
                    "skill": "",
                    "size": 0
                }
                break;
            case "Object":
                itemData = {
                    "description": "",
                    "weight": 0,
                    "size": 0,
                    "cost": ""
                }
                break;
            case "Shield":
                itemData = {
                    "traits": "",
                    "protection": 0,
                    "weight": 0,
                    "bulk": 0,
                    "cost": "",
                    "size": 0
                }
                break;
            case "Armor":
                itemData = {
                    "traits": "",
                    "protection": 0,
                    "weight": 0,
                    "bulk": 0,
                    "type": "",
                    "cost": "",
                    "size": 0
                }
                break;

        }
        const data = {
            name: `new ${value}`,
            type: value,
            system: itemData
        }
        data.system.quantity = 1;
        data.system.baseWeight = 0;
        const [embedded] = await actor.createEmbeddedDocuments("Item", [data]);

        const Contents = Array.from(this.document.system.contents);
        const objectToAdd = { "name": embedded.name, "uuid": embedded.uuid };
        Contents.push(objectToAdd);

        await this.document.update({
            "system.contents": Contents
        });

    }

    async UpdateWeight() {
        let weightUsedCenti = 0;

        for (const content of this.document.system.contents) {
            const item = await fromUuid(content.uuid);
            const cleanWeight = Math.round(Number(item.system.weight ?? 0) * 100);
            weightUsedCenti += cleanWeight;
        }

        const weightUsed = weightUsedCenti / 100;
        const weightRemaining = Math.round(
            (Number(this.document.system.weightAllowed ?? 0) * 100 - weightUsedCenti)
        ) / 100;

        await this.document.update({
            "system.weight": weightUsed,
            "system.weightRemaining": weightRemaining
        });
    }

    async _OnChangeQuantity(event) {
        event.preventDefault();
        const value = Number(event.target.value);
        const id = event.target.dataset.itemId;
        const actor = this.document.actor

        const item = actor.items.get(id);
        const update = {};
        const baseWeight = Number(item.system.baseWeight ?? 0);

        const newWeight = Math.round(
            (baseWeight * value) * 100
        ) / 100;
        if (Number(PJActorAPI.getCurrentWeight(actor)) + newWeight > Number(PJActorAPI.getMaxWeight(actor))) return;
        if (newWeight > Number(this.document.system.weightRemaining)) return;
        update[`system.quantity`] = value;
        update[`system.weight`] = newWeight;
        await item.update(update);
        await this.UpdateWeight();
        await PJActorAPI.onUpdateWeight(actor);
    }

    async _onChangeWeightAllowed(event) {
        event.preventDefault();
        const value = Number(event.target.value);
        const rounded = roundTo(value, 2);

        const update = {};
        update[`system.weightAllowed`] = rounded;
        update[`system.weightRemaining`] = rounded;

        await this.document.update(update);

    }

    async _onDeleteItem(event, target) {
        const itemId = target.dataset.itemId;
        const actor = this.document.actor;

        const item = actor.items.get(itemId);
        if (!item) return;

        await actor.deleteEmbeddedDocuments("Item", [itemId]);

        const update = {};
        const contents = Array.from(this.document.system.contents);
        const itemIndex = contents.findIndex(i => i.uuid === item.uuid);

        if (itemIndex != -1) {
            contents.splice(itemIndex, 1);
        }
        update[`system.contents`] = contents;

        await this.document.update(update);
        await this.UpdateWeight();

        const { typeOfItem, isInEquipment } = PJActorAPI.isInEquipment(itemId, actor);

        if (isInEquipment && (typeOfItem === "Armor" || typeOfItem === "Shield")) {
            target.dataset.itemType = typeOfItem;
            await PJActorAPI.onUnEquipArmor(target, actor);
        }
        if (isInEquipment && (typeOfItem === "Weapon")) {
            await PJActorAPI.onUnequipWeapon(actor);
        }
        await PJActorAPI.onUpdateWeight(actor);
    }

    async _onTransfertItem(event, target) {
        const actor = this.document.actor;
        const containers = PJActorAPI.getContainers(actor);
        const itemToTransfer = target.dataset.itemId;

        const options = containers
            .map(container => `
                <option value="${container.uuid}">
                ${container.name}
                </option>
            `)
            .join("");
        const content =
            `<form>
            <form class="form-group">
                <div class = "transfert-group">
                    <label>Destination</label>
                    <select id="transfert-select" name="transfertDestination">
                        ${options}
                    </select>
                </div>
            </form>
        </form>`;
        new Dialog({
            title: `$Transfer menu`,
            content,
            buttons: {
                roll: {
                    label: "Roll",
                    callback: html => this._onConfirmTransfer(html, itemToTransfer)
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "roll"
        }).render(true);
    }

    static async #_OnPrintItem(event, target) {
        event.preventDefault();

        const itemId = target.dataset.itemId;
        const itemDoc = this.document.actor.items.get(itemId);
        itemDoc.sheet.render(true);
    }

    async _onConfirmTransfer(html, originTransfer) {
        const form = html[0].querySelector("form");
        const destinationId = form.transfertDestination.value;
        const actor = this.document.actor;
        const item = actor.items.get(originTransfer);
        const destinationContainer = await fromUuid(destinationId);
        const baseWeight = Number(item.system.baseWeight ?? 0);

        if (Number(item.system.weight) > destinationContainer.system.weightRemaining) return;
        const update1 = {}; const update2 = {};
        if (item.system.quantity > 1) {
            const newQuantity = item.system.quantity - 1;

            update1[`system.quantity`] = newQuantity;
            update1[`system.weight`] = Math.round((baseWeight * newQuantity) * 100) / 100;
        }
        else {
            const contents = this.document.system.contents;
            const index = contents.findIndex(i => i.name === item.name);
            contents.splice(index, 1);
            update1[`system.contents`] = contents;
            await this.document.update(update1);
        }

        const targetContents = destinationContainer.system.contents;
        const targetIndex = targetContents.findIndex(i => i.name === item.name);
        if (targetIndex != -1) {
            const targetContent = targetContents[targetIndex];
            const targetItem = await fromUuid(targetContent);
            const newQuantity = targetItem.system.quantity + 1;

            update2[`system.quantity`] = newQuantity;
            update2[`system.baseWeight`] = baseWeight;
            update2[`system.weight`] = Math.round((baseWeight * newQuantity) * 100) / 100;
            await targetItem.update(update2);
        }
        else {
            const itemData = item.toObject();
            itemData.system.quantity = 1;
            itemData.system.weight = roundTo(itemData.system.weight, 2);
            const [embedded] = await actor.createEmbeddedDocuments("Item", [itemData]);

            const objectToAdd = { "name": embedded.name, "uuid": embedded.uuid };
            targetContents.push(objectToAdd);

            await destinationContainer.update({
                "system.contents": targetContents
            });
        }
        await PJActorAPI.UpdateAllContainers(actor);

    }
}

class SpellSystemSheet extends NonObjectItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addTypeofSpell: function (event, target) { this._onAddTypeofSpell(event, target); },
            removeTypeofSpell: function (event, target) { this._onRemoveTypeofSpell(event, target); }
        },
        window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/spellSystem-sheet.html",
            scrollable: [".object-body"],
        }
    }

    async _onAddTypeofSpell(event, target) {
        const existingTypes = Array.from(this.document.system.existingTypeOfSpells);
        const newType = "new spell type";
        existingTypes.push(newType);
        const update = {};
        update[`system.existingTypeOfSpells`] = existingTypes;
        this.document.update(update);
    }

    async _onRemoveTypeofSpell(event, target) {
        const existingTypes = Array.from(this.document.system.existingTypeOfSpells);
        const index = target.dataset.itemIndex;
        existingTypes.splice(index, 1);
        const update = {};
        update[`system.existingTypeOfSpells`] = existingTypes;
        this.document.update(update);
    }
    constructor(...args) {
        super(...args);

        this._onChangeSpecificTypeBound = this._onChangeSpecificType.bind(this);
    }
    _onRender(context, options) {
        this.element.querySelectorAll('input[name*="system.existingTypeOfSpells"]').forEach(inp =>
            inp.addEventListener("change", this._onChangeSpecificTypeBound)
        );
    }
    async _onChangeSpecificType(event) {
        event.preventDefault();
        const index = event.target.name.split(".")[2];
        const value = event.target.value;
        const existingTypes = Array.from(this.document.system.existingTypeOfSpells);
        existingTypes[index] = value;
        const update = {};
        update[`system.existingTypeOfSpells`] = existingTypes;
        this.document.update(update);

    }
}

class SpellSheet extends NonObjectItemsSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            handler: this.onSubmitForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/spell-sheet.html",
            scrollable: [".object-body"],
        }
    }
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.spellTypes = Object.keys(Restricted);
        context.restrictedAttributes = Restricted;
        return context;
    }
}

class LifePathInfoSheet extends InfoSheet {
    async _onAddPossibilty(event, target) {
        event.preventDefault();
        const possibilities = Array.from(this.document.system.possibilities);
        const newPossibility = "new possibility";
        possibilities.push(newPossibility);
        const update = {};
        update[`system.possibilities`] = possibilities;
        this.document.update(update);
    }

    async _onRemovePossibility(event, target) {
        event.preventDefault();
        const possibilities = Array.from(this.document.system.possibilities);
        const index = target.dataset.itemIndex;
        possibilities.splice(index, 1);
        const update = {};
        update[`system.possibilities`] = possibilities;
        this.document.update(update);
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.cultures = game.items.filter(i => i.type === "Culture");

        return context;
    }

    constructor(...args) {
        super(...args);

        this._onChangePossibilityBound = this._onChangePossibility.bind(this);
        this._onChangeCultureBound = this._onChangeCulture.bind(this);
        this._onChangeNameBound = this._onChangeName.bind(this);
    }
    _onRender(context, options) {
        this.element.querySelectorAll('input[name*="system.possibilities"]').forEach(inp =>
            inp.addEventListener("change", this._onChangePossibilityBound)
        );

        this.element.querySelectorAll('select[name*="system.culture"]').forEach(inp =>
            inp.addEventListener("change", this._onChangeCultureBound)
        );

        this.element.querySelectorAll('input[name="name"]').forEach(inp =>
            inp.addEventListener("change", this._onChangeNameBound)
        )

    }
    async _onChangePossibility(event) {
        event.preventDefault();
        const index = event.target.name.split(".")[2];
        const value = event.target.value;
        const existingTypes = Array.from(this.document.system.possibilities);
        existingTypes[index] = value;
        const update = {};
        update[`system.possibilities`] = existingTypes;
        this.document.update(update);
    }

    async _onChangeCulture(event) {
        event.preventDefault();
        const value = event.target.value;
        const update = {};
        update[`system.culture`] = value;
        this.document.update(update);
    }

    async _onChangeName(event) {
        event.preventDefault();
        const value = event.target.value;

        await this.document.update({
            name: value
        });
    }
}

class FamilyStandingSheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        },
        window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class ParentMishapsSheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        }, window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class CrucialChildhoodMomentSheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        }, window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class ChildhoodMemorySheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        }, window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class StrokeofFortuneSheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        }, window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class StrokeofTragedySheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        }, window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class FatefulEncounterSheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        }, window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class DramaticEncounterSheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        }, window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
    }
}

class RomanceSheet extends LifePathInfoSheet {
    static DEFAULT_OPTIONS = {
        classes: ["testsystem", "sheet", "item"],
        width: 400,
        height: 300,
        tag: 'form',
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            addPossibility: function (event, target) { this._onAddPossibilty(event, target); },
            removePossibilty: function (event, target) { this._onRemovePossibility(event, target); }
        }, window: {
            resizable: true
        }
    }
    static PARTS = {
        main: {
            template: "systems/testsystem/templates/lifepathInfo-sheet.html",
            scrollable: [".object-body"],
        }
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

Hooks.on("preCreateItem", (item, data, options, userId) => {
    if (data.type == "Weapon" || data.type == "Ranged Weapon" || data.type == "Fighting School") {
        const system = data.system ?? {};
        system.skills = [];
        for (const [skill, list] of Object.entries(Fighting)) {
            if (!system.skills.includes(skill)) {
                system.skills.push(skill);
            }
        }
        item.updateSource({ system });
    }
});

Hooks.on("preUpdateItem", (item, data, options, userId) => {
    const actor = item.actor;
    if (!item.actor) return;

    if (data.system?.weight !== undefined) {
        const oldWeight = item.system.weight;
        const newWeight = data.system.weight;
        if (newWeight < 0) return false;
        if (newWeight > oldWeight) {
            const containers = actor.items.filter(i => i.type === "Container");

            for (const container of containers) {
                const isInside = container.system.contents?.some(c => c.uuid === item.uuid);
                if (!isInside) continue;
                const weightDifference = newWeight - oldWeight;
                if (container.system.weight + weightDifference > container.system.weightAllowed) return false;
                if (actor.system.weight + weightDifference > actor.system.maxWeight) return false;
            }
        }
    }
    if (data.system?.size !== undefined) {
        const newSize = data.system.size;
        const containers = actor.items.filter(i => i.type === "Container");

        for (const container of containers) {
            const isInside = container.system.contents?.some(c => c.uuid === item.uuid);
            if (!isInside) continue;
            if (newSize > container.system.maxSize) return false;
        }

    }

})

Hooks.on("updateItem", async (item, data, option, userId) => {
    const actor = item.actor;
    if (!actor) return;

    const containers = actor.items.filter(i => i.type === "Container");

    for (const container of containers) {
        const isInside = container.system.contents?.some(c => c.uuid === item.uuid);
        if (!isInside) continue;

        if (container.sheet?.rendered) {
            container.sheet.render(false);
        }
    }
    await PJActorAPI.UpdateAllContainers(actor);
    await PJActorAPI.onUpdateWeight(actor);
});

Hooks.once("init", async () => {
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

    foundry.documents.collections.Items.registerSheet("testsystem", AmmunitionSheet, {
        type: ["Ammunition"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", WeaponSheet, {
        types: ["Weapon"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", RangedWeaponSheet, {
        types: ["Ranged Weapon"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", ThrownWeaponSheet, {
        types: ["Thrown Weapon"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", FightingManeuverSheet, {
        types: ["Fighting Maneuver"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", FightingSchoolSheet, {
        types: ["Fighting School"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", ContainerSheet, {
        types: ["Container"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", SpellSystemSheet, {
        types: ["SpellSystem"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", SpellSheet, {
        types: ["Spell"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", FamilyStandingSheet, {
        types: ["Lifepath - Family Standing"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", ParentMishapsSheet, {
        types: ["Lifepath - Parent Mishaps"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", CrucialChildhoodMomentSheet, {
        types: ["Lifepath - Crucial Childhood Moment"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", ChildhoodMemorySheet, {
        types: ["Lifepath - Childhood Memory"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", StrokeofFortuneSheet, {
        types: ["Lifepath - Stroke of Fortune"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", StrokeofTragedySheet, {
        types: ["Lifepath - Stroke of Tragedy"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", FatefulEncounterSheet, {
        types: ["Lifepath - Fateful Encounter"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", DramaticEncounterSheet, {
        types: ["Lifepath - Dramatic Encounter"],
        makeDefault: true
    });

    foundry.documents.collections.Items.registerSheet("testsystem", RomanceSheet, {
        types: ["Lifepath - Romance"],
        makeDefault: true
    });


    Handlebars.registerHelper("handleNames", function (str) {
        if (typeof str !== "string") return "";
        const spaced = str.replace(/([A-Z])/g, " $1").trim();
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    });
    Handlebars.registerHelper("includes", function (array, value) {
        return array.includes(value);
    });
    Handlebars.registerHelper("eq", function (a, b) {
        return a === b;
    });
    Handlebars.registerHelper("toNumber", value => Number(value))
    Handlebars.registerHelper("not", function (value) {
        return !value;
    });
    Handlebars.registerHelper("round", function (value, decimals) {
        return Number(Math.round(value + "e" + decimals) + "e-" + decimals);
    });
});



Hooks.on("updateActiveEffect", async (effect, changed, option, userId) => {
    if (!changed.changes) return;
    const updates = [];
    for (const change of effect.changes) {
        if (change.key.endsWith(".MaxValue")) {
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



