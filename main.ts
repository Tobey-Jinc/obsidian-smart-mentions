import { MarkdownView, Plugin } from 'obsidian';

let mentions: HTMLElement | null = null;

export default class AB extends Plugin
{
	getLinkedMentions(currFilePath: string)
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
			mentions = this.addStatusBarItem();
			mentions.classList.add("mentions");

			// Only display mentions if necessary
			if (linkedMentions.length > 0)
			{
				// Only display a maximum of 5 mentions
				let length = linkedMentions.length;
				if (length > 5)
				{
					length = 5;
				}
	
				// Loop through each mention
				for (let i = 0; i < length; i++)
				{
					// Get mention
					let link = linkedMentions[i];
	
					// Remove all file information (folder/file.md --> file)
					let sanitizedLink = link.replace(/^.*[\\\/]/, '');
					sanitizedLink = sanitizedLink.replace(".md", '');
	
					// Add the mention to the status bar
					mentions.createEl("a", { text: sanitizedLink, href: this.pathToURL(link), cls: "mention" });

					// Add a space as long as it isn't the final mention
					if (i != length - 1)
					{
						mentions.createEl("span", { text: "    ", cls: "mention-title" });
					}
				}
			}
			else // No mentions exist for this file
			{
				mentions.createEl("span", { text: "No Mentions...", cls: "mention-title-muted" });
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
