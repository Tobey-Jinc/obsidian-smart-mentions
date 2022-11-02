import { MarkdownView, Plugin } from 'obsidian';

let mentions: HTMLElement | null = null;	// The div that contains the mentions bar
let cameFrom: string = "";					// The path of the previous note

const MAX_CHARACTERS: number = 30;			// Max amount of character before mentions are added to overflow menu

export class LinkedMentions {
	path: string; 	// Path of mentions
	links: number;	// Total number of links this note contains
}

export default class AB extends Plugin
{
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
	
					if (view?.file.name != sanitizedLink + ".md") // Don't add self to mention block
					{
						// If mentions bar is too long, then add to overflow menu ...
						if (totalCharacters > MAX_CHARACTERS)
						{
							leftOvers = leftOvers.concat(link);
						}
						else // ... otherwise, add to mentions bar
						{
							// If link is the previous note, then add a back arrow
							// ! The back arrow character (🡨) may not be supported in all operating systems
							if (link == cameFrom) { sanitizedLink = "🡨 " + sanitizedLink }

							// Add link to bar
							mentions.createEl("a", { text: sanitizedLink, href: this.pathToURL(link), cls: "mention", attr: {"draggable": "false"} });

							// Add space if necessary
							if (i != length - 1 || leftOvers.length > 0)
							{
								mentions.createEl("span", { text: " / ", cls: "mention-space" });
							}
						}
						
						totalCharacters += sanitizedLink.length;
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
	}

	async onload()
	{
		// Execute showLinks whenever a file is opened
		this.registerEvent(
		this.app.workspace.on('file-open', () => 
			{
				return this.showLinks();
			}),
		);
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
