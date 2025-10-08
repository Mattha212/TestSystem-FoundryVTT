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
        return context;
    }
    activateListeners(html){
        super.activateListeners(html);
        this._tabs = this._tabs || {};
        this._tabs["primary"] = new Tabs({
            navSelector: ".sheet-tabs",
            contentSelector: ".sheet-body",
            initial: "stats"
        });
        this._tabs["primary"].bind(html[0]);
    }
}
Hooks.once("init", ()=>{
    console.log("Test System | Initialization...");
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("testsystem", PJSheet, {
    types: ["PJ"],
    makeDefault: true
    });
});
