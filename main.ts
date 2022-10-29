import { MarkdownView, Plugin } from 'obsidian';

let mentions: HTMLElement | null = null;
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
		// console.log(Object.keys(allFiles));

		let linkedMentions : LinkedMentions[] = [];
		Object.keys(allFiles).forEach((key) => {
			if (currFilePath in allFiles[key])
			{
				// console.log(Object.keys(allFiles[key]).length);
				linkedMentions.push({path: key, links: Object.keys(allFiles[key]).length});
			}
		});

		linkedMentions = linkedMentions.sort((a,b) => b.links - a.links);
		console.log(linkedMentions);
		console.log("=====================================");

		return linkedMentions.sort();
	}

	getNumberOfLinks(currFilePath: string)
	{
		/*
			This method is taken from https://github.com/dalcantara7/obsidian-auto-moc
		*/
		const allFiles = this.app.metadataCache.resolvedLinks;
		
		let linkedMentions: Array<string> = [];
		Object.keys(allFiles).forEach((key) => {
			if (currFilePath in allFiles[key])
			{
				linkedMentions.push(key);
			}
		});


		
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

			// Clear the shown mentions from the previous file if necessary
			if (mentions != null)
			{
				mentions.remove();
			}

			// Add a status bar item with mentions class
			// mentions = this.addStatusBarItem();
			// mentions.classList.add("mentions");
			mentions = view?.containerEl.createEl("div", { cls: "mentions" });
			mentions.createEl("div", {cls: "mentions-background"});

			// Only display mentions if necessary
			if (linkedMentions.length > 0)
			{
				if (hidden)
				{
					mentions.addClass("mentions-reveal")
					hidden = false;
				}
				else
				{
					mentions.addClass("mentions-revealed")
				}

				// Only display a maximum of 5 mentions
				let length = linkedMentions.length;
	
				// Loop through each mention
				for (let i = 0; i < length; i++)
				{
					// Get mention
					let link = Object.values(linkedMentions[i])[0];
	
					// Remove all file information (folder/file.md --> file)
					let sanitizedLink = this.sanitizeLink(link);

					console.log(sanitizedLink);
	
					// Add the mention to the status bar
					if (view?.file.name != sanitizedLink + ".md") // Don't add self to mention block
					{

						mentions.createEl("a", { text: sanitizedLink, href: this.pathToURL(link), cls: "mention" });

						// Add a space as long as it isn't the final mention
						if (i != length - 1)
						{
							if (this.sanitizeLink(Object.values(linkedMentions[i + 1])[0]) + ".md" != view?.file.name)
							{
								// console.log("----------------");
								// console.log(this.sanitizeLink(Object.values(linkedMentions[i + 1])[0]));
								// console.log(sanitizedLink);
								mentions.createEl("span", { text: " / ", cls: "mention-space" });
							}
						}
					}
				}
			}
			else // No mentions exist for this file
			{
				if (!hidden)
				{
					mentions.addClass("mentions-hide")
					hidden = true;
				}
				else
				{
					mentions.addClass("mentions-hidden")
				}
				mentions.createEl("span", { text: "No Mentions", cls: "mention-title-muted" });
			}
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
}
