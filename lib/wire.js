"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("debug");
const crypto = require("crypto");
const es2015_1 = require("hubot/es2015");
const api_client_1 = require("@wireapp/api-client");
const client_1 = require("@wireapp/api-client/dist/commonjs/client/");
const core_1 = require("@wireapp/core");
const store_engine_1 = require("@wireapp/store-engine");
const PayloadBundle_1 = require("@wireapp/core/dist/conversation/PayloadBundle");
const content_1 = require("@wireapp/core/dist/conversation/content");
const debug = debug_1.default('hubot-wire');
class WireExtendedTextMessage extends es2015_1.TextMessage {
    constructor(user, wirePayloadBundle) {
        super(user, wirePayloadBundle.content && wirePayloadBundle.content.text, wirePayloadBundle.id);
        this.wirePayloadBundle = wirePayloadBundle;
    }
}
exports.WireExtendedTextMessage = WireExtendedTextMessage;
class Wire extends es2015_1.Adapter {
    constructor(robot) {
        super(robot);
        this.wireEngine = new store_engine_1.FileEngine();
        this.wireClient = new api_client_1.APIClient({
            store: this.wireEngine,
            urls: api_client_1.APIClient.BACKEND.PRODUCTION,
        });
        this.wireAccount = new core_1.Account(this.wireClient);
        if (!process.env.WIRE_EMAIL) {
            throw new Error('[hubot-wire] environment variable `WIRE_EMAIL` is required');
        }
        if (!process.env.WIRE_PASS) {
            throw new Error('[hubot-wire] environment variable `WIRE_PASS` is required');
        }
    }
    send(envelope, string) {
        debug(`Send ${JSON.stringify(envelope)}, ${JSON.stringify(string)}`);
        // TODO build asset messages for e.g. images
        // const links = R.filter(R.startsWith('_asset'), strings)
        const textPayload = this.wireAccount
            .service.conversation.createText(string)
            .build();
        this.wireAccount
            .service.conversation.send(envelope.room, textPayload)
            .then(val => debug(`Sent text with id ${val.id}`))
            .catch(err => this.robot.logger.error('[hubot-wire] Send text failed:', err));
    }
    reply(envelope, string) {
        if (!envelope.message ||
            !(envelope.message instanceof WireExtendedTextMessage)) {
            this.robot.logger.error(`[hubot-wire] Replying message must be WireExtendedTextMessage ${JSON.stringify(envelope)}, ${JSON.stringify(string)}`);
            return;
        }
        else {
            debug(`Reply ${JSON.stringify(envelope)}, ${JSON.stringify(string)}`);
        }
        const textPayload = this.wireAccount
            .service.conversation.createText(string)
            .withQuote({
            // quotedMessageId: envelope.message.wirePayloadBundle.id,
            // content: envelope.message.wirePayloadBundle.content as TextContent,
            quotedMessageId: envelope.message.wirePayloadBundle.id,
            quotedMessageSha256: this.sha256(envelope.message.wirePayloadBundle.content.text),
        })
            .build();
        this.wireAccount
            .service.conversation.send(envelope.room, textPayload)
            .then(val => debug(`Sent text with id ${val.id}`))
            .catch(err => this.robot.logger.error('[hubot-wire] Send text failed:', err));
    }
    emote(envelope) {
        console.warn(`emote ${JSON.stringify(envelope)}`);
    }
    topic(envelope) {
        console.warn(`topic ${JSON.stringify(envelope)}`);
    }
    play(envelope) {
        console.warn(`play ${JSON.stringify(envelope)}`);
    }
    async run() {
        debug('Starting...');
        this.robot.logger.info('robot Starting');
        try {
            const storeName = await this.wireEngine.init('hubot-wire');
            debug(`Initialized FileEngine, store name ${storeName}`);
            await this.listenMessages();
            const loginContext = await this.wireAccount.login({
                clientType: client_1.ClientType.PERMANENT,
                email: process.env.WIRE_EMAIL,
                password: process.env.WIRE_PASS,
            });
            if (!loginContext) {
                throw new Error('[hubot-wire] @wireapp/core Account#login returns undefined');
            }
            debug(`Logged in as ${loginContext.userId}, client ${loginContext.clientId}`);
            await this.wireAccount.listen();
            debug('Listening for messages ...');
            this.emit('connected');
        }
        catch (err) {
            this.robot.logger.error('[hubot-wire] bootstrap failed:', err);
        }
    }
    async close() {
        debug('Logging out');
        await this.wireAccount.logout();
        debug('Logout succeed, shutting down.');
        this.robot.shutdown();
    }
    sha256(input) {
        return crypto
            .createHash('sha256')
            .update(input)
            .digest();
    }
    listenMessages() {
        debug('Wire client object built');
        this.wireAccount
            .on(PayloadBundle_1.PayloadBundleType.TEXT, d => this.handleText(d))
            .on(PayloadBundle_1.PayloadBundleType.CONFIRMATION, d => this.handleConfirmation(d))
            .on(PayloadBundle_1.PayloadBundleType.ASSET, d => this.sendConfirmation(d))
            .on(PayloadBundle_1.PayloadBundleType.ASSET_IMAGE, d => this.sendConfirmation(d))
            .on(PayloadBundle_1.PayloadBundleType.LOCATION, d => this.sendConfirmation(d))
            .on(PayloadBundle_1.PayloadBundleType.PING, d => this.sendConfirmation(d))
            .on(PayloadBundle_1.PayloadBundleType.CONNECTION_REQUEST, d => console.log('CONNECTION_REQUEST', d));
        debug('Wire event handlers set');
    }
    async wireUidToUser(data) {
        const { conversation: room, from: uid } = data;
        const brain = this.robot.brain;
        if (brain.users().hasOwnProperty(uid)) {
            return brain.userForId(uid);
        }
        const wireUser = await this.wireClient.user.api.getUser(uid);
        return brain.userForId(uid, {
            name: wireUser.name,
            alias: wireUser.handle,
            room: room,
        });
    }
    async sendConfirmation(data) {
        debug(`Send receipt confirmation for ${data.type} id ${data.id}`);
        const confirmationPayload = this.wireAccount.service.conversation.createConfirmationRead(data.id);
        return this.wireAccount.service.conversation.send(data.conversation, confirmationPayload);
    }
    handleConfirmation(data) {
        if (data.content && content_1.ContentType.isConfirmationContent(data.content)) {
            const ids = [data.content.firstMessageId].concat(data.content.moreMessageIds || []);
            debug(`Got confirmation for msg ids ${ids}`);
        }
    }
    async handleText(data) {
        const { conversation: conversationId, content, from } = data;
        if (!content || !content_1.ContentType.isTextContent(content))
            return;
        debug(`Received "${data.type}" ("${data.id}") in "${conversationId}" from "${from}": ${content.text}`);
        await this.sendConfirmation(data);
        const hubotUser = await this.wireUidToUser(data);
        const message = new WireExtendedTextMessage(hubotUser, data);
        this.receive(message);
    }
}
exports.use = (robot) => new Wire(robot);
//# sourceMappingURL=wire.js.map