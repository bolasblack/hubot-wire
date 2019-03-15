import { Adapter, TextMessage, Envelope, Robot, User } from 'hubot/es2015';
import { PayloadBundleType, PayloadBundleIncoming } from '@wireapp/core/dist/conversation/PayloadBundle';
import { TextContent } from '@wireapp/core/dist/conversation/content';
export declare class WireExtendedTextMessage extends TextMessage {
    wirePayloadBundle: PayloadBundleIncoming & {
        type: PayloadBundleType.TEXT;
        content: TextContent;
    };
    constructor(user: User, wirePayloadBundle: PayloadBundleIncoming & {
        type: PayloadBundleType.TEXT;
        content: TextContent;
    });
}
declare class Wire extends Adapter<Robot<Wire>> {
    private wireEngine;
    private wireClient;
    private wireAccount;
    constructor(robot: Robot<Wire>);
    send(envelope: Envelope, string: string): void;
    reply(envelope: Envelope, string: string): void;
    emote(envelope: Envelope): void;
    topic(envelope: Envelope): void;
    play(envelope: Envelope): void;
    run(): Promise<void>;
    close(): Promise<void>;
    private sha256;
    private listenMessages;
    private wireUidToUser;
    private sendConfirmation;
    private handleConfirmation;
    private handleText;
}
export declare const use: <ROBOT extends Robot<any>>(robot: ROBOT) => Wire;
export {};
