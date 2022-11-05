import SmartMentions from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class SmartMentionsSettingsTab extends PluginSettingTab {
    plugin: SmartMentions;
  
    constructor(app: App, plugin: SmartMentions) {
      super(app, plugin);
      this.plugin = plugin;
    }
  
    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        // Title
        containerEl.createEl("h1", {text: "Smart Mentions Settings"});

        new Setting(containerEl)
        .setName("Hide Underscore")
        .setDesc("Will hide the underscore at the beginning of notes eg. _Home will be displayed as just Home.")
        .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.hideFrontUnderScore)
                    .onChange(async (value) => {
                        this.plugin.settings.hideFrontUnderScore = value;
                        await this.plugin.saveSettings();
                        this.display();
                    })
        );

        new Setting(containerEl)
        .setName("Find Folder Note")
        .setDesc("Will try to find the folder note. If one can't be found then the note with the highest number of links is used instead.")
        .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.useFolderNotes)
                    .onChange(async (value) => {
                        this.plugin.settings.useFolderNotes = value;
                        await this.plugin.saveSettings();
                        this.display();
                    })
        );

        if (this.plugin.settings.useFolderNotes)
        {
            new Setting(containerEl)
            .setName("Minimum Number of Links")
            .setDesc("The minimum number of links in a note to be considered a folder note, in the event an actual folder note cannot be found.")
            .addSlider(slider => slider
                        .setLimits(1, 100, 1)
                        .setDynamicTooltip()
                        .setValue(this.plugin.settings.minimumNumberOfLinks)
                        .onChange(async (value) => {
                            this.plugin.settings.minimumNumberOfLinks = value;
                            await this.plugin.saveSettings();
                        })
            );

            new Setting(containerEl)
            .setName("Root Folder Note")
            .setDesc("Since the root directory has no folder name, a folder note name needs to be manually set. Do not include file extensions!")
            .addText((text) => text
                        .setPlaceholder("_Home")
                        .setValue(this.plugin.settings.rootFolderNote)
                        .onChange(async (value) => {
                            this.plugin.settings.rootFolderNote = value;
                            await this.plugin.saveSettings();
                        })
            );
        }
    }
  }