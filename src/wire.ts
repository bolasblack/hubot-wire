import createDebug from 'debug'
import * as crypto from 'crypto'
import { Adapter, TextMessage, Envelope, Robot, User } from 'hubot/es2015'
import { APIClient } from '@wireapp/api-client'
import { ClientType } from '@wireapp/api-client/dist/commonjs/client/'
import { Account } from '@wireapp/core'
import { FileEngine } from '@wireapp/store-engine'
import {
  PayloadBundleType,
  PayloadBundleIncoming,
} from '@wireapp/core/dist/conversation/PayloadBundle'
import {
  ContentType,
  TextContent,
} from '@wireapp/core/dist/conversation/content'

const debug = createDebug('hubot-wire')

export class WireExtendedTextMessage extends TextMessage {
  constructor(
    user: User,
    public wirePayloadBundle: PayloadBundleIncoming & {
      type: PayloadBundleType.TEXT
      content: TextContent
    },
  ) {
    super(
      user,
      wirePayloadBundle.content && wirePayloadBundle.content.text,
      wirePayloadBundle.id,
    )
  }
}

class Wire extends Adapter<Robot<Wire>> {
  private wireEngine = new FileEngine()

  private wireClient = new APIClient({
    store: this.wireEngine,
    urls: APIClient.BACKEND.PRODUCTION,
  })

  private wireAccount = new Account(this.wireClient)

  constructor(robot: Robot<Wire>) {
    super(robot)

    if (!process.env.WIRE_EMAIL) {
      throw new Error(
        '[hubot-wire] environment variable `WIRE_EMAIL` is required',
      )
    }
    if (!process.env.WIRE_PASS) {
      throw new Error(
        '[hubot-wire] environment variable `WIRE_PASS` is required',
      )
    }
  }

  send(envelope: Envelope, string: string) {
    debug(`Send ${JSON.stringify(envelope)}, ${JSON.stringify(string)}`)
    // TODO build asset messages for e.g. images
    // const links = R.filter(R.startsWith('_asset'), strings)
    const textPayload = this.wireAccount
      .service!.conversation.createText(string)
      .build()
    this.wireAccount
      .service!.conversation.send(envelope.room, textPayload)
      .then(val => debug(`Sent text with id ${val.id}`))
      .catch(err =>
        this.robot.logger.error('[hubot-wire] Send text failed:', err),
      )
  }

  reply(envelope: Envelope, string: string) {
    if (
      !envelope.message ||
      !(envelope.message instanceof WireExtendedTextMessage)
    ) {
      this.robot.logger.error(
        `[hubot-wire] Replying message must be WireExtendedTextMessage ${JSON.stringify(
          envelope,
        )}, ${JSON.stringify(string)}`,
      )
      return
    } else {
      debug(`Reply ${JSON.stringify(envelope)}, ${JSON.stringify(string)}`)
    }

    const textPayload = this.wireAccount
      .service!.conversation.createText(string)
      .withQuote({
        // quotedMessageId: envelope.message.wirePayloadBundle.id,
        // content: envelope.message.wirePayloadBundle.content as TextContent,
        quotedMessageId: envelope.message.wirePayloadBundle.id,
        quotedMessageSha256: this.sha256(
          (envelope.message.wirePayloadBundle.content as TextContent).text,
        ),
      })
      .build()
    this.wireAccount
      .service!.conversation.send(envelope.room, textPayload)
      .then(val => debug(`Sent text with id ${val.id}`))
      .catch(err =>
        this.robot.logger.error('[hubot-wire] Send text failed:', err),
      )
  }

  emote(envelope: Envelope) {
    console.warn(`emote ${JSON.stringify(envelope)}`)
  }

  topic(envelope: Envelope) {
    console.warn(`topic ${JSON.stringify(envelope)}`)
  }

  play(envelope: Envelope) {
    console.warn(`play ${JSON.stringify(envelope)}`)
  }

  async run() {
    debug('Starting...')
    this.robot.logger.info('robot Starting')

    try {
      const storeName = await this.wireEngine.init('hubot-wire')
      debug(`Initialized FileEngine, store name ${storeName}`)

      await this.listenMessages()

      const loginContext = await this.wireAccount.login({
        clientType: ClientType.PERMANENT,
        email: process.env.WIRE_EMAIL,
        password: process.env.WIRE_PASS,
      })
      if (!loginContext) {
        throw new Error(
          '[hubot-wire] @wireapp/core Account#login returns undefined',
        )
      }

      debug(
        `Logged in as ${loginContext.userId}, client ${loginContext.clientId}`,
      )

      await this.wireAccount.listen()

      debug('Listening for messages ...')

      this.emit('connected')
    } catch (err) {
      this.robot.logger.error('[hubot-wire] bootstrap failed:', err)
    }
  }

  async close() {
    debug('Logging out')
    await this.wireAccount.logout()
    debug('Logout succeed, shutting down.')
    this.robot.shutdown()
  }

  private sha256(input: string) {
    return crypto
      .createHash('sha256')
      .update(input)
      .digest()
  }

  private listenMessages() {
    debug('Wire client object built')
    this.wireAccount
      .on(PayloadBundleType.TEXT, d => this.handleText(d))
      .on(PayloadBundleType.CONFIRMATION, d => this.handleConfirmation(d))
      .on(PayloadBundleType.ASSET, d => this.sendConfirmation(d))
      .on(PayloadBundleType.ASSET_IMAGE, d => this.sendConfirmation(d))
      .on(PayloadBundleType.LOCATION, d => this.sendConfirmation(d))
      .on(PayloadBundleType.PING, d => this.sendConfirmation(d))
      .on(PayloadBundleType.CONNECTION_REQUEST, d =>
        console.log('CONNECTION_REQUEST', d),
      )
    debug('Wire event handlers set')
  }

  private async wireUidToUser(data: PayloadBundleIncoming) {
    const { conversation: room, from: uid } = data
    const brain = this.robot.brain
    if (brain.users().hasOwnProperty(uid)) {
      return brain.userForId(uid)
    }
    const wireUser = await this.wireClient.user.api.getUser(uid)
    return brain.userForId(uid, {
      name: wireUser.name,
      alias: wireUser.handle,
      room: room,
    })
  }

  private async sendConfirmation(data: PayloadBundleIncoming) {
    debug(`Send receipt confirmation for ${data.type} id ${data.id}`)
    const confirmationPayload = this.wireAccount.service!.conversation.createConfirmationRead(
      data.id,
    )
    return this.wireAccount.service!.conversation.send(
      data.conversation,
      confirmationPayload,
    )
  }

  private handleConfirmation(data: PayloadBundleIncoming) {
    if (data.content && ContentType.isConfirmationContent(data.content)) {
      const ids = [data.content.firstMessageId].concat(
        data.content.moreMessageIds || [],
      )
      debug(`Got confirmation for msg ids ${ids}`)
    }
  }

  private async handleText(data: PayloadBundleIncoming) {
    const { conversation: conversationId, content, from } = data
    if (!content || !ContentType.isTextContent(content)) return
    debug(
      `Received "${data.type}" ("${
        data.id
      }") in "${conversationId}" from "${from}": ${content.text}`,
    )
    await this.sendConfirmation(data)
    const hubotUser = await this.wireUidToUser(data)
    const message = new WireExtendedTextMessage(hubotUser, data as any)
    this.receive(message)
  }
}

export const use = <ROBOT extends Robot<any>>(robot: ROBOT) => new Wire(robot)
