const { cosmiconfigSync } = require("cosmiconfig");

const Telegraf = require("telegraf");
const commandParts = require("telegraf-command-parts");

const { VM } = require("vm2");
const { inspect } = require("util");

const explorer = cosmiconfigSync("telegram-evaluator");
const search = {
	token: "",
	whitelist: [],
	...explorer.search(),
};

const chunk = require("lodash.chunk");

/**
 * Wraps text in a code block.
 * @param {*} thing The thing to wrap in a code block.
 * @param {boolean} tag Whether to include a JavaScript syntax highlighting tag.
 * @returns {string} The code block-wrapped text.
 */
function codeBlock(thing, tag) {
	return "```" + (tag ? "js" : "") + "\n" + thing.toString() + "\n```";
}

if (search && search.config) {
	const config = search.config;

	const bot = new Telegraf(config.token);
	bot.use(commandParts());

	bot.start(ctx => {
		if (config.whitelist.includes(ctx.from.id)) {
			ctx.reply("Welcome to the bot.");
		} else {
			ctx.reply("Sorry, you are not on the whitelist. You may not use this bot.");
		}
	});
	bot.command("eval", async ctx => {
		if (!config.whitelist.includes(ctx.from.id)) {
			return ctx.reply("You may not use this command.");
		}

		const code = ctx.state.command.args.trim();
		if (code === "") {
			return ctx.reply("You must provide a JavaScript snippet to evaluate.");
		}

		const vm = new VM({
			timeout: 1000,
		});
		vm.freeze(ctx, "ctx");
		vm.freeze(ctx.message.text, "msg");

		try {
			const output = vm.run(code);
			const inspected = inspect(output);

			const notice = "Snippet returned with the following value (type `" + typeof output + "`): ";
			const fullBlock = codeBlock(inspected, true);

			if ((notice + fullBlock).length < 4096) return ctx.replyWithMarkdown(notice + fullBlock);

			// Long message fallback
			ctx.replyWithMarkdown(notice);
			const chunks = chunk(inspected, 4088);
			for await (const chunked of chunks) {
				const partialBlock = codeBlock(chunked.join(""));
				await ctx.replyWithMarkdown(partialBlock);
			}
		} catch (error) {
			if (error && error.stack && !error.stack.includes("vm")) throw error;
			ctx.replyWithMarkdown("Failed to run that snippet. The error is as follows: " + codeBlock(error));
		}
	});

	bot.launch();
}