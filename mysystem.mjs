console.log("Mon système est chargé !");

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
            const currentValueStrength = this.actor.system.stats["Strength"].CurrentValue;
            const currentValueAgility = this.actor.system.stats["Agility"].CurrentValue;

            if(newValue<=maxValue*0.75 && newValue>maxValue*0.5){
                update[`system.stats.${"Agility"}.CurrentValue`] = currentValueAgility - 10;
            }
            else if(newValue<=maxValue*0.5 && newValue>maxValue*0.25){
                update[`system.stats.${"Strength"}.CurrentValue`] = currentValueStrength -10;
            }
            else if(newValue<=maxValue*0.25 && newValue>0){
                update[`system.stats.${"Agility"}.CurrentValue`] = currentValueAgility - 10;
                update[`system.stats.${"Strength"}.CurrentValue`] = currentValueStrength -10;
            }
            }
        }
        await this.actor.update(update);

        await super._onChangeInput(event);

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

Hooks.once("init", ()=>{
    console.log("Test System | Initialization...");
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
    Handlebars.registerHelper("includes", function (array, value) {
    return array.includes(value);
  });
});
