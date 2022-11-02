import { link } from 'fs';
import { MarkdownView, Plugin } from 'obsidian';

let mentions: HTMLElement | null = null;
let cameFromEl: HTMLElement | null = null;
let cameFrom: string = "";
let hidden: boolean = true;

export class LinkedMentions {
	path: string;
	links: number;
}

export default class AB extends Plugin
{
	getLinkedMentions(currFilePath: string)
	{
		/*
			This method is taken from https://github.com/dalcantara7/obsidian-auto-moc
		*/
		const allFiles = this.app.metadataCache.resolvedLinks;

		let linkedMentions : LinkedMentions[] = [];
		Object.keys(allFiles).forEach((key) => {
			if (currFilePath in allFiles[key])
			{
				linkedMentions.push({path: key, links: Object.keys(allFiles[key]).length});
			}
		});

		linkedMentions = linkedMentions.sort((a,b) => b.links - a.links);

		return linkedMentions.sort();
	}

	pathToURL (path: String)
	{
		/*
			Converts a path (folder/subfolder/file.md) to an Obsidian URL
			path (String) : the path to be converted to an Obsidian URL
		*/

		// Get vault name and create the URL "header"
		let name = app.vault.getName();
		let header = "obsidian://open?vault=" + name + "&file=";

		// Replace spaces and slashes with their Obsidian URL counterpart
		path = path.replace(/ /g, "%20");
		path = path.replace(/\//g, "%2F");
		path = path.replace(".md", "");

		// Create the final URL
		let url = header + path;
		
		return url;
	}

	sanitizeLink (link: String)
	{
		let sanitizedLink = link.replace(/^.*[\\\/]/, '');
		sanitizedLink = sanitizedLink.replace(".md", '');

		return sanitizedLink;
	}

	addLink (links: Array<object>, linkToAdd: string) {
		let duplicate = false

		links.forEach(link => {
			if (Object.values(link)[0] == linkToAdd)
			{
				duplicate = false;
			}
		});

		if (!duplicate)
		{
			links.unshift({path: linkToAdd, links: 1});
		}

		return links;
	}

	showLinks () {
		/*
			Puts all linked mentions in the status bar
		*/

		// Get current file
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (view != null && view.file.extension === "md")
		{
			// Get linked mentions
			let linkedMentions = this.getLinkedMentions(view.file.path);

			if (cameFrom != "")
			{
				let duplicate = false

				linkedMentions.forEach(link => {
					if (Object.values(link)[0] == cameFrom)
					{
						duplicate = true;
					}
				});
	
				if (!duplicate)
				{
					linkedMentions = linkedMentions.concat({path: cameFrom, links: 1});
				}
	
				// Clear the shown mentions from the previous file if necessary
				if (mentions != null)
				{
					mentions.remove();
				}
			}

			// Add a status bar item with mentions class
			mentions = view?.containerEl.createEl("div", { cls: "mentions" });
			mentions.createEl("div", {cls: "mentions-background"});
			mentions.addClass("mentions-revealed")

			let onlyFileIsValid;

			if (linkedMentions.length == 1 )
			{
				onlyFileIsValid = (this.sanitizeLink(Object.values(linkedMentions[0])[0]) + ".md" != view?.file.name)
			}
			else
			{
				onlyFileIsValid = true;
			}

			// Only display mentions if necessary
			if (linkedMentions.length > 0 && onlyFileIsValid)
			{
				let totalCharacters = 0;
				let leftOvers: Array<string> = [];

				// Only display a maximum of 5 mentions
				let length = linkedMentions.length;
				
				console.log("---------------------");
				console.log(cameFrom);

				// Loop through each mention
				for (let i = 0; i < length; i++)
				{
					// Get mention
					let link = Object.values(linkedMentions[i])[0];

					if (link == cameFrom && cameFromEl != null)
					{
						cameFromEl.remove();
					}
	
					// Remove all file information (folder/file.md --> file)
					let sanitizedLink = this.sanitizeLink(link);
	
					// Add the mention to the status bar
					if (view?.file.name != sanitizedLink + ".md") // Don't add self to mention block
					{
						if (totalCharacters > 30)
						{
							leftOvers = leftOvers.concat(link);
						}
						else
						{
							// Add link
							if (link == cameFrom) { sanitizedLink = "🡨 " + sanitizedLink }
							mentions.createEl("a", { text: sanitizedLink, href: this.pathToURL(link), cls: "mention", attr: {"draggable": "false"} });

							// Add space
							if (i != length - 1 || leftOvers.length > 0)
							{
								if (view?.file.name != this.sanitizeLink(Object.values(linkedMentions[i + 1])[0]) + ".md")
								{
									mentions.createEl("span", { text: " / ", cls: "mention-space" });
								}
							}
						}

						totalCharacters += sanitizedLink.length;
					}
				}

				if (leftOvers.length > 0)
				{
					mentions.createEl("input", { type: "checkbox", cls: "mention", attr: {"draggable": "false", "id": "mention-extra-button"} });
					mentions.createEl("label", { text: "+", cls: "mention mention-open-extra-menu", attr: {"draggable": "false", "for": "mention-extra-button"} });
					let extra_menu = mentions.createEl("div", {cls: "mention-extra-menu"});
					extra_menu.createEl("div", {cls: "mention-extra-menu-background"});
					let extra_menu_item_container = extra_menu.createEl("div", {cls: "mention-extra-menu-item-container"});

					for (let i = 0; i < leftOvers.length; i++)
					{
						let sanitizedLink = this.sanitizeLink(leftOvers[i]);
						if (leftOvers[i] == cameFrom) { sanitizedLink = "🡨 " + sanitizedLink }
						extra_menu_item_container.createEl("a", { text: sanitizedLink, href: this.pathToURL(leftOvers[i]), cls: "mention-extra-menu-item", attr: {"draggable": "false"} });
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
		if (mentions != null)
		{
			mentions.remove();
		}
	}
}
