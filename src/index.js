const { cosmiconfigSync } = require("cosmiconfig");
const Telegraf = require("telegraf");

const { VM } = require("vm2");
const { inspect } = require("util");

const explorer = cosmiconfigSync("telegram-evaluator");
const search = {
	token: "",
	whitelist: [],
	...explorer.search(),
};

const chunk = require("lodash.chunk");

function codeBlock(thing) {
	return "```\n" + thing.toString() + "\n```";
}

if (search && search.config) {
	const config = search.config;

	const bot = new Telegraf(config.token);

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

		const msg = ctx.message.text;
		const code = msg.replace("/eval ", "");

		const vm = new VM({
			timeout: 1000,
		});
		vm.freeze(ctx, "ctx");
		vm.freeze(msg, "msg");

		try {
			const output = vm.run(code);
			const inspected = inspect(output);

			const notice = "Snippet returned with the following value (type `" + typeof output + "`): ";
			const fullBlock = codeBlock(inspected);

			if ((notice + fullBlock).length < 4096) return ctx.replyWithMarkdown(notice + fullBlock);

			// Long message fallback
			ctx.replyWithMarkdown(notice);
			const chunks = chunk(inspected, 4088)
			for await (chunked of chunks) {
				const partialBlock = codeBlock(chunked.join(""));
				console.log(partialBlock)
				await ctx.replyWithMarkdown(partialBlock);
			}
		} catch (error) {
			if (error && error.stack && !error.stack.includes("vm")) throw error;
			ctx.replyWithMarkdown("Failed to run that snippet. The error is as follows: " + codeBlock(error));
		}
	});

	bot.launch();
}