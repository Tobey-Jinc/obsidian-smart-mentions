import { link } from 'fs';
import { MarkdownView, Plugin } from 'obsidian';
import { SmartMentionsSettingsTab } from "./settings";

let mentions: HTMLElement | null = null;	// The div that contains the mentions bar
let cameFrom: string = "";					// The path of the previous note
let folderNote: string = "";

const MAX_CHARACTERS: number = 36;			// Max amount of character before mentions are added to overflow menu

export class LinkedMentions {
	path: string; 	// Path of mentions
	links: number;	// Total number of links this note contains
}

interface SmartMentionsSettings
{
	hideFrontUnderScore: boolean;		// Should underscores at start of name be hidden (_home become home)
	useFolderNotes: boolean;			// Does this vault use folder notes / should folder notes attempt to be found
		minimumNumberOfLinks: number;	// The minimum number of links a note can have for to be considered a potential folder note
		rootFolderNote: string;			// Since root does have a name, a folder note name must be manually set
		recursiveSearch: boolean;		// Will search parent folders if a folder note can't be found in the current folder
}

const DEFAULT_SETTINGS: Partial<SmartMentionsSettings> = {
	hideFrontUnderScore: true,
	useFolderNotes: true,
		minimumNumberOfLinks: 5,
		rootFolderNote: "_Home",
		recursiveSearch: true,
}

export default class SmartMentions extends Plugin
{
	settings: SmartMentionsSettings;

	/**
	 * Gets all the mentions of the active note and sorts them by how many links they contain
	 * 
	 * @remarks
	 * This is a modified method from https://github.com/dalcantara7/obsidian-auto-moc
	 * 
	 * @param currFilePath The path of the active note
	 * @returns A list of LinkedMentions objects
	 */
	getLinkedMentions(currFilePath: string)
	{
		// Get all files
		const allFiles = this.app.metadataCache.resolvedLinks;

		// Create list of mentions
		let linkedMentions : LinkedMentions[] = [];

		// Loop through each file
		Object.keys(allFiles).forEach((key) => {
			// If the file mentions the current file ...
			if (currFilePath in allFiles[key] && key != currFilePath)
			{
				// ... add that files path and number of links to the list of mentions
				linkedMentions.push({path: key, links: Object.keys(allFiles[key]).length});
			}
		});

		// Sort list of mentions by number of links
		linkedMentions = linkedMentions.sort((a,b) => b.links - a.links);

		return linkedMentions;
	}

	/**
	 * Tries to determine the folder note
	 * 
	 * @remarks If a note has the same name as the folder, the that is returned. Otherwise, the note with the most links is chosen (assuming it has more than the minimum)
	 * 
	 * @param currFilePath 
	 * @returns The folder note
	 */
	findFolderNote(currFilePath: string)
	{
		folderNote = "";

		if (this.settings.useFolderNotes)
		{
			// Get all files
			const allFiles = this.app.metadataCache.resolvedLinks;

			let fileImportanceList : LinkedMentions[] = [];

			// Get the folders of the current note (folder/folder/note.md becomes folder/folder)
			let currFolderDir = currFilePath.substring(0, currFilePath.lastIndexOf("/"));

			// Loop through each file
			Object.keys(allFiles).forEach((key) => {
				// Find the lowest folder name (a/b/note.md becomes b)
				let folders = key.split("/");
				let folderNoteName = folders[folders.length - 2]
				if (folderNoteName == undefined)
				{
					folderNoteName = this.settings.rootFolderNote;
				}

				// Find the folders of the this note (folder/folder/note.md becomes folder/folder)
				let folderDir = key.substring(0, key.lastIndexOf("/"));

				// Check if the note is contained in the active notes folder
				if (folderDir == currFolderDir)
				{
					// Check if the file is the true folder note
					if (folderNoteName == this.sanitizeLink(key))
					{
						folderNote = key;
						return folderNote; // return because all of notes are now redundant
					}

					fileImportanceList.push({path: key, links: Object.keys(allFiles[key]).length});
				}
			});

			// If a folder note has not been found
			if (folderNote == "")
			{
				// Sort by number of links
				fileImportanceList = fileImportanceList.sort((a,b) => b.links - a.links);

				// Check if the first note contains enough links
				if (fileImportanceList.length > 0)
				{
					if (Object.values(fileImportanceList[0])[1] >= this.settings.minimumNumberOfLinks)
					{
						// * Make sure the first and second file don't have the same amount of links
						let matched = false;
						
						if (fileImportanceList.length > 2)
						{
							if (Object.values(fileImportanceList[0])[1] == Object.values(fileImportanceList[1])[1])
							{
								matched = true; // At this point, no folder note exists
							}
						}
	
						if (!matched)
						{
							// Then, Assume the note with the largest number of links is the folder note (or equivalent)
							folderNote = Object.values(fileImportanceList[0])[0];
						}
					}
				}
			}

			if (this.settings.recursiveSearch)
			{
				// * -----------------------------------------------------------------------------
				// * The following is used to find the folder note in the above folder if a folder
				// * note can't be found or the active note is the folder note.

				// Get folders
				let folders = currFilePath.split("/");

				// Check if a valid note was found
				if ((folderNote == currFilePath || folderNote == "") && folders.length >= 2)
				{
					folders.splice(folders.length - 2, 1); // Remove the lowest folder
					folders.splice(folders.length - 1, 1); // Remove the file name
					// Add this name instead. Used to make sure a note of the same name isn't found. If one is, god help you :)
					folders.push("k1s128865adg⇎f12sdk42fjgk↻gas4dfkjg234sdfquytwe8r↨")
					// * folder/folder/note.md becomes folder/k1s128865adg⇎f12sdk42fjgk↻gas4dfkjg234sdfquytwe8r↨
					// Run the function again with the parent directory
					this.findFolderNote(folders.join("/"));
				}
				// * -----------------------------------------------------------------------------
			}
		}
	}

	/**
	 * Converts a path (folder/subfolder/file.md) to an Obsidian URL
	 * 
	 * @example
	 * Converts "folder/subfolder/test file.md" from vault called "Example" to obsidian://open?vault=Example&file=folder%2Fsubfolder%2Ftest%20file
	 * 
	 * @param path The path to be converted to an Obsidian URL
	 * @returns An Obsidian URL
	 */
	pathToURL (path: String)
	{

		// Get vault name and create the URL "header"
		let name = app.vault.getName();
		let header = "obsidian://open?vault=" + name + "&file=";

		// Replace spaces and slashes with their Obsidian URL counterpart
		path = path.replace(/ /g, "%20");	// Replaces spaces
		path = path.replace(/\//g, "%2F");	// Replaces slashes
		path = path.replace(".md", "");		// Remove extension

		// Create the final URL
		let url = header + path;
		
		return url;
	}

	/**
	 * Returns the name of a path
	 * 
	 * @example
	 * "folder/file.md" becomes just "file"
	 * 
	 * @param link the path of the file
	 * @returns A link that contains no folder info or extension
	 */
	sanitizeLink (link: String)
	{
		let sanitizedLink = link.replace(/^.*[\\\/]/, '');	// Remove folder info
		sanitizedLink = sanitizedLink.replace(".md", '');	// Remove extension

		return sanitizedLink;
	}

	/**
	 * Updates the came from link
	 * 
	 * @remarks This is triggered when a file is renamed to make sure the came from mention is up to date and prevents broken links
	 */
	updateCameFrom()
	{
		// Get current file
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (view != null && view.file.extension === "md")
		{
			cameFrom = view.file.path;
		}
		else
		{
			cameFrom = "";
		}
	}

	/**
	 * The brains of the plugin. Adds all mentions to a bar at the bottom center of the current note.
	 */
	showLinks () {
		// Get current file
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		// Make sure a markdown note is being viewed
		if (view != null && view.file.extension === "md")
		{
			// Get linked mentions
			let linkedMentions = this.getLinkedMentions(view.file.path);

			// Get folder note
			this.findFolderNote(view.file.path);

			if (folderNote != "")
			{
				// Add folder note to FRONT of mentions
				linkedMentions.unshift({path: folderNote, links: 1});
			}

			if (cameFrom != "")
			{
				// If the the previous link isn't in the mentions, then add it
				let duplicate = false;

				// Loop through mentions
				linkedMentions.forEach(link => {
					if (Object.values(link)[0] == cameFrom) // It's a duplicate so don't add
					{
						duplicate = true;
					}
				});
	
				if (!duplicate) // Only add if it doesn't exist
				{
					// (1 is given as the link number because it is just added to the end of the mentions
					//  so it is redundant)
					linkedMentions = linkedMentions.concat({path: cameFrom, links: 1});
				}
			}

			// * Remove duplicates based on path
			linkedMentions = linkedMentions.filter((value, index, self) =>
				index === self.findIndex((name) => (
					name.path === value.path
				))
			);

			// Clear the shown mentions from the previous file if necessary
			if (mentions != null)
			{
				mentions.remove();
			}

			// Create the parent containing div
			mentions = view?.containerEl.createEl("div", { cls: "mentions" });
			mentions.createEl("div", {cls: "mentions-background"}); //  Add the background

			// Only display mentions if necessary
			if (linkedMentions.length > 0)
			{
				let totalCharacters = 0;
				let leftOvers: Array<string> = [];	// Mentions to display in overflow menu

				// Only display a maximum of 5 mentions
				let length = linkedMentions.length;

				// Loop through each mention
				for (let i = 0; i < length; i++)
				{
					// Get mention
					let link = Object.values(linkedMentions[i])[0];
	
					// Sanitize active notes path
					let sanitizedLink = this.sanitizeLink(link);
	
					// let notFolderNote = true;
					// if (i > 0 && folderNote == link) { notFolderNote = false }

					if (view?.file.path != link) // Don't add self to mention block
					{
						totalCharacters += sanitizedLink.length;

						// If mentions bar is too long, then add to overflow menu ...
						if (totalCharacters > MAX_CHARACTERS && i != 0)
						{
							leftOvers = leftOvers.concat(link);
						}
						else // ... otherwise, add to mentions bar
						{
							if (this.settings.hideFrontUnderScore && sanitizedLink[0] == "_")
							{
								sanitizedLink = sanitizedLink.substring(1);
							}

							// If the note is the folder note, add a "🖿"
							if (link == folderNote) { sanitizedLink = "🖿 " + sanitizedLink }
							// If link is the previous note, then add a back arrow
							// ! The back arrow character (🡨) may not be supported in all operating systems
							else if (link == cameFrom) { sanitizedLink = "🡨 " + sanitizedLink }

							// Add link to bar
							mentions.createEl("a", { text: sanitizedLink, href: this.pathToURL(link), cls: "mention", attr: {"draggable": "false"} });

							// Add space if necessary
							if (i != length - 1 || leftOvers.length > 0)
							{
								mentions.createEl("span", { text: " / ", cls: "mention-space" });
							}
						}
					}
				}

				if (leftOvers.length > 0)
				{
					// * Add show / hide button for the overflow menu
					// An invisible checkbox is used ...
					mentions.createEl("input", { type: "checkbox", cls: "mention", attr: {"draggable": "false", "id": "show-overflow-menu-checkbox"} });
					// ... A label then acts as the face of the input. So when the label is clicked, the checkbox is checked and the overflow menu is shown / hidden
					mentions.createEl("label", { text: "+", cls: "mention overflow-menu-label-button", attr: {"draggable": "false", "for": "show-overflow-menu-checkbox"} });

					// Create the overflow menu
					let extra_menu = mentions.createEl("div", {cls: "overflow-menu"});
					// Add background
					extra_menu.createEl("div", {cls: "overflow-menu-background"});
					// Add container for items (this is used so the background doesn't scroll with the items)
					let extra_menu_item_container = extra_menu.createEl("div", {cls: "overflow-menu-item-container"});

					// Loop through left over mentions
					for (let i = 0; i < leftOvers.length; i++)
					{
						let sanitizedLink = this.sanitizeLink(leftOvers[i]);

						// If link is the previous note, then add a back arrow
						// ! The back arrow character (🡨) may not be supported in all operating systems
						if (leftOvers[i] == cameFrom) { sanitizedLink = "🡨 " + sanitizedLink }

						// Add link to overflow menu
						extra_menu_item_container.createEl("a", { text: sanitizedLink, href: this.pathToURL(leftOvers[i]), cls: "overflow-menu-item", attr: {"draggable": "false"} });
						extra_menu_item_container.createEl("br");
					};
				}
			}

			cameFrom = view.file.path;
		}
		else
		{
			cameFrom = "";
		}
	}

	async onload()
	{
		await this.loadSettings();
		this.addSettingTab(new SmartMentionsSettingsTab(this.app, this));

		// Execute showLinks whenever a file is opened
		this.registerEvent(
		this.app.workspace.on('file-open', () => 
			{
				return this.showLinks();
			}),
		);

		// Update cameFrom when a file is renamed
		this.registerEvent(
		this.app.vault.on('rename', () => 
			{
				return this.updateCameFrom();
			}),
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload()
	{
		// Destroy the mentions bar when the plugin is disabled
		if (mentions != null)
		{
			mentions.remove();
		}
	}
}
