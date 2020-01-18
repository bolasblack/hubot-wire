import createDebug from 'debug'
import { Adapter, TextMessage, Envelope, Robot, User } from 'hubot/es2015'
import { Account } from '@wireapp/core'
import { PayloadBundleType } from '@wireapp/core/dist/conversation'
import { ContentType } from '@wireapp/core/dist/conversation/content'
import * as OtrMessage from '@wireapp/core/dist/conversation/message/OtrMessage'
import { APIClient } from '@wireapp/api-client'
import { ClientType } from '@wireapp/api-client/dist/client'
import { Confirmation } from '@wireapp/protocol-messaging'
import { FileEngine } from '@wireapp/store-engine-fs'

const debug = createDebug('hubot-wire')

export class WireExtendedTextMessage extends TextMessage {
  constructor(user: User, public wireMsg: OtrMessage.TextMessage) {
    super(user, wireMsg.content.text, wireMsg.id)
  }
}

/**
 * See also:
 *
 * https://github.com/wireapp/wire-web-packages/blob/92194194363b3801bd33cf3b1b90f21d00b1d178/packages/core/src/demo/echo.js
 * https://github.com/wireapp/wire-web-packages/blob/92194194363b3801bd33cf3b1b90f21d00b1d178/packages/core/src/demo/sender.js
 */
export class Wire extends Adapter<Robot<Wire>> {
  private wireClient = new APIClient({
    urls: APIClient.BACKEND.PRODUCTION,
  })

  private wireAccount = new Account(
    this.wireClient,
    this.wireEngineProvider.bind(this),
  )

  constructor(robot: Robot<Wire>) {
    super(robot)

    if (!process.env.WIRE_EMAIL) {
      throw new Error(
        '[hubot-wire] Environment variable `WIRE_EMAIL` is required',
      )
    }
    if (!process.env.WIRE_PASS) {
      throw new Error(
        '[hubot-wire] Environment variable `WIRE_PASS` is required',
      )
    }
  }

  async send(envelope: Envelope, string: string) {
    debug(`Send ${JSON.stringify(envelope)}, ${JSON.stringify(string)}`)

    const textPayload = this.wireAccount
      .service!.conversation.messageBuilder.createText(envelope.room, string)
      .build()

    try {
      const res = await this.wireAccount.service!.conversation.send(textPayload)
      debug(`Sent text with id ${res.id}`)
    } catch (err) {
      this.robot.logger.error('[hubot-wire] Send text failed:', err)
    }
  }

  async reply(envelope: Envelope, content: string) {
    if (!(envelope.message instanceof WireExtendedTextMessage)) {
      this.robot.logger.error(
        `[hubot-wire] Replying message must be WireExtendedTextMessage ${content}, ${envelope}`,
      )
      return
    }

    debug(`Reply ${envelope}, ${content}`)

    const { wireMsg } = envelope.message

    const textPayload = this.wireAccount
      .service!.conversation.messageBuilder.createText(envelope.room, content)
      .withQuote(wireMsg)
      .build()

    try {
      const res = await this.wireAccount.service!.conversation.send(textPayload)
      debug(`Sent text with id ${res.id}`)
    } catch (err) {
      this.robot.logger.error('[hubot-wire] Reply text failed:', err)
    }
  }

  async run() {
    this.robot.logger.info('Bootstrapping...')
    debug('Bootstrapping...')

    await this.listenAccountMessages()
    await this.listenClientEvents()

    try {
      await this.wireAccount.login({
        clientType: ClientType.PERMANENT,
        email: process.env.WIRE_EMAIL,
        password: process.env.WIRE_PASS,
      })

      debug(
        `Logged in as ${this.wireAccount.userId}, client ${this.wireAccount.clientId}`,
      )

      await this.wireAccount.listen()

      this.emit('connected')
    } catch (err) {
      this.robot.logger.error('[hubot-wire] Bootstrap failed:', err)
    }
  }

  async close() {
    debug('Logging out...')
    await this.wireAccount.logout()
    debug('Logout succeed, shutting down...')
    this.robot.shutdown()
  }

  private async wireEngineProvider(storeName: string) {
    const engine = new FileEngine()
    await engine.init(storeName, { fileExtension: '.json' })
    return engine
  }

  private async listenClientEvents() {
    this.wireClient.on(APIClient.TOPIC.ON_LOGOUT, async err => {
      this.robot.logger.error('[hubot-wire] Logged out', err)
    })
  }

  private async listenAccountMessages() {
    this.wireAccount
      .on(PayloadBundleType.TEXT, d => this.handleText(d))
      .on(PayloadBundleType.CONFIRMATION, d => this.handleConfirmation(d))
  }

  private async getUser(msg: OtrMessage.OtrMessage) {
    const { conversation: room, from: uid } = msg
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

  private async sendConfirmation(msg: OtrMessage.OtrMessage) {
    debug(`Send receipt confirmation for ${msg.type} id ${msg.id}`)

    const confirmationPayload = this.wireAccount.service!.conversation.messageBuilder.createConfirmation(
      msg.conversation,
      msg.id,
      Confirmation.Type.READ,
    )
    return this.wireAccount.service!.conversation.send(confirmationPayload)
  }

  private handleConfirmation(data: OtrMessage.OtrMessage) {
    if (data.content && ContentType.isConfirmationContent(data.content)) {
      const ids = [data.content.firstMessageId].concat(
        data.content.moreMessageIds || [],
      )

      debug(`Got confirmation for msg ids ${ids}`)
    }
  }

  private async handleText(msg: OtrMessage.TextMessage) {
    const { conversation: conversationId, content, from } = msg

    if (!content || !ContentType.isTextContent(content)) return

    debug(
      `Received "${msg.type}" ("${msg.id}") in "${conversationId}" from "${from}": ${content.text}`,
    )

    await this.sendConfirmation(msg)

    const hubotUser = await this.getUser(msg)

    const message = new WireExtendedTextMessage(hubotUser, msg as any)

    this.receive(message)
  }
}

export const use = <ROBOT extends Robot<any>>(robot: ROBOT) => new Wire(robot)
