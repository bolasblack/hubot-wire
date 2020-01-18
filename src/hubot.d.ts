declare module 'hubot/node_modules/log' {
  import { EventEmitter } from 'events'
  import { Stream } from 'stream'

  export type Level =
    | 'debug'
    | 'info'
    | 'notice'
    | 'warning'
    | 'error'
    | 'critical'
    | 'alert'
    | 'emergency'

  export const DEBUG: 7
  export const INFO: 6
  export const NOTICE: 5
  export const WARNING: 4
  export const ERROR: 3
  export const CRITICAL: 2
  export const ALERT: 1
  export const EMERGENCY: 0

  export default class Log extends EventEmitter {
    level: number
    stream: Stream

    constructor(level: number | Level, stream: Stream)
    read(): void

    debug(...args: any[]): void
    info(...args: any[]): void
    notice(...args: any[]): void
    warning(...args: any[]): void
    error(...args: any[]): void
    critical(...args: any[]): void
    alert(...args: any[]): void
    emergency(...args: any[]): void
  }
}

declare module 'hubot/es2015' {
  export * from 'hubot'
}

declare module 'hubot' {
  export { default as Adapter } from 'hubot/src/adapter'
  export { default as Brain } from 'hubot/src/brain'
  export { DataStore, DataStoreUnavailable } from 'hubot/src/datastore'
  export { Listener, TextListener } from 'hubot/src/listener'
  export {
    Message,
    TextMessage,
    EnterMessage,
    LeaveMessage,
    TopicMessage,
    CatchAllMessage,
  } from 'hubot/src/message'
  export { default as Robot } from 'hubot/src/robot'
  export { default as Response, Envelope } from 'hubot/src/response'
  export { default as User } from 'hubot/src/user'

  import Adapter from 'hubot/src/adapter'
  import Robot from 'hubot/src/robot'
  export function loadBot<ADAPTER extends Adapter<any> = Adapter<any>>(
    adapterPath: string | undefined,
    adapterName: string,
    enableHttpd?: boolean,
    botName?: string,
    botAlias?: string,
  ): Robot<ADAPTER>
}

declare module 'hubot/src/adapter' {
  import { EventEmitter } from 'events'
  import { Message } from 'hubot/src/message'
  import { Envelope } from 'hubot/src/response'
  import Robot from 'hubot/src/robot'

  export default class Adapter<
    ROBOT extends Robot<any> = Robot<any>
  > extends EventEmitter {
    protected robot: ROBOT

    constructor(robot: ROBOT)

    send(envelope: Envelope, ...messages: string[]): void

    emote(envelope: Envelope, ...messages: string[]): void

    reply(envelope: Envelope, ...messages: string[]): void

    topic(envelope: Envelope, ...messages: string[]): void

    play(envelope: Envelope, ...messages: string[]): void

    run(envelope: Envelope, ...messages: string[]): void

    close(envelope: Envelope, ...messages: string[]): void

    receive(message: Message): void

    http(url: string): ReturnType<ROBOT['http']>
  }
}

declare module 'hubot/src/brain' {
  import { EventEmitter } from 'events'
  import Robot from 'hubot/src/robot'
  import User, { ContructOptions as UserContructOptions } from 'hubot/src/user'

  export default class Brain<
    DATA extends object = {},
    ROBOT extends Robot<any> = Robot<any>
  > extends EventEmitter {
    constructor(robot: ROBOT)

    set<K extends keyof DATA>(key: K, value: DATA[K]): this

    get<K extends keyof DATA>(key: K): DATA[K] | null

    remove<K extends keyof DATA>(key: K): this

    save(): void

    close(): void

    setAutoSave(enabled: boolean): void

    resetSaveInterval(seconds: number): void

    mergeData(data?: {
      users?: { [id in User['id']]: User }
      _private?: DATA
    }): void

    users(): User[]

    userForId(id: User['id'], options?: UserContructOptions<ROBOT>): User

    userForName(name: string): User | null

    usersForRawFuzzyName(fuzzyName: string): User[]

    usersForFuzzyName(fuzzyName: string): User[]
  }
}

declare module 'hubot/src/datastore' {
  import Robot from 'hubot/src/robot'
  import User from 'hubot/src/user'

  export abstract class DataStore<
    DATA extends object = {},
    ROBOT extends Robot<any> = Robot<any>
  > {
    constructor(robot: ROBOT)

    set<K extends keyof DATA>(key: K, value: DATA[K]): Promise<void>

    setObject<K1 extends keyof DATA, K2 extends keyof DATA[K1]>(
      key: K1,
      objectKey: K2,
      value: DATA[K1][K2],
    ): ReturnType<this['set']>

    setArray<K extends keyof DATA>(
      key: K,
      value: DATA[K],
    ): ReturnType<this['set']>

    get<K extends keyof DATA>(key: K): Promise<DATA[K] | undefined>

    getObject<K1 extends keyof DATA, K2 extends keyof DATA[K1]>(
      key: K1,
      objectKey: K2,
    ): Promise<DATA[K1][K2] | undefined>

    protected abstract _set<K extends keyof DATA>(
      key: K,
      value: DATA[K],
      table: string,
    ): Promise<void>

    protected abstract _get<K extends keyof DATA>(
      key: K,
      table: string,
    ): Promise<DATA[K] | undefined>
  }

  export class DataStoreUnavailable extends Error {}
}

declare module 'hubot/src/listener' {
  import { Message, TextMessage } from 'hubot/src/message'
  import Response from 'hubot/src/response'
  import Robot from 'hubot/src/robot'
  import User from 'hubot/src/user'

  export type Matcher = (message: Message) => boolean

  export type ConstructOptions = {
    id?: string
    [key: string]: any
  }

  export type ConstructCallback<ROBOT extends Robot<any>> = (
    response: Response<ROBOT>,
  ) => void

  export class Listener<ROBOT extends Robot<any> = Robot<any>> {
    constructor(
      robot: ROBOT,
      matcher: Matcher,
      callback: ConstructCallback<ROBOT>,
    )
    constructor(
      robot: ROBOT,
      matcher: Matcher,
      options: ConstructOptions,
      callback: ConstructCallback<ROBOT>,
    )

    call(
      message: Message,
      middleware?: any,
      didMatchCallback?: (matched: boolean) => void,
    ): boolean
  }

  export class TextListener<
    ROBOT extends Robot<any> = Robot<any>
  > extends Listener<ROBOT> {
    constructor(robot: ROBOT, regex: RegExp, callback: ConstructCallback<ROBOT>)
    constructor(
      robot: ROBOT,
      regex: RegExp,
      options: ConstructOptions,
      callback: ConstructCallback<ROBOT>,
    )
  }
}

declare module 'hubot/src/message' {
  import User from 'hubot/src/user'

  export abstract class Message {
    user: User
    text: string
    done: boolean

    constructor(user: User, done: boolean)

    finish(): void
  }

  export class TextMessage extends Message {
    id: string

    constructor(user: User, text: string, id: string)

    match(regex: RegExp): ReturnType<String['match']>

    toString(): string
  }

  export class EnterMessage extends Message {
    id: string
  }

  export class LeaveMessage extends Message {
    id: string
  }

  export class TopicMessage extends Message {
    id: string
  }

  export class CatchAllMessage extends Message {
    id: string
    message: Message

    constructor(message: Message)
  }
}

declare module 'hubot/src/middleware' {
  import Robot from 'hubot/src/robot'

  type Context = {}
  type NextFn = (context: Context, done: DoneFn) => void
  type DoneFn = () => void

  export interface Middleware<ROBOT extends Robot<any> = Robot<any>> {
    execute(context: Context, next: NextFn, done: DoneFn): void

    register(middleware: Middleware<ROBOT>): void
  }

  export class Middleware<ROBOT extends Robot<any> = Robot<any>>
    implements Middleware<ROBOT> {
    constructor(robot: ROBOT)
  }

  export default Middleware
}

declare module 'hubot/src/response' {
  import { Message } from 'hubot/src/message'
  import Robot from 'hubot/src/robot'
  import User from 'hubot/src/user'

  export interface Envelope {
    room: User['room']
    user: User
    message?: Message
  }

  export interface Response<ROBOT extends Robot<any> = Robot<any>> {
    send(...messages: string[]): void

    emote(...messages: string[]): void

    reply(...messages: string[]): void

    topic(...messages: string[]): void

    play(...messages: string[]): void

    random<T>(items: T[]): T

    finish(): void

    http: ROBOT['http']
  }

  export class Response<ROBOT extends Robot<any> = Robot<any>>
    implements Response<ROBOT> {
    constructor(
      robot: ROBOT,
      message: Message,
      match: ReturnType<String['match']>,
    )
  }

  export default Response
}

declare module 'hubot/src/robot' {
  import { EventEmitter } from 'events'
  import Log from 'hubot/node_modules/log'
  import * as HttpClient from 'scoped-http-client'
  import Adapter from 'hubot/src/adapter'
  import Brain from 'hubot/src/brain'
  import * as Listener from 'hubot/src/listener'
  import { Message } from 'hubot/src/message'
  import Middleware from 'hubot/src/middleware'
  import Response, { Envelope } from 'hubot/src/response'

  export interface Robot<A extends Adapter> {
    alias: string
    brain: Brain
    name: string
    readonly adapter: A
    readonly logger: Log

    listen(
      matcher: Listener.Matcher,
      callback: Listener.ConstructCallback<this>,
    ): void
    listen(
      matcher: Listener.Matcher,
      options: Listener.ConstructOptions,
      callback: Listener.ConstructCallback<this>,
    ): void

    hear(regex: RegExp, callback: Listener.ConstructCallback<this>): void
    hear(
      regex: RegExp,
      options: Listener.ConstructOptions,
      callback: Listener.ConstructCallback<this>,
    ): void

    respond(regex: RegExp, callback: Listener.ConstructCallback<this>): void
    respond(
      regex: RegExp,
      options: Listener.ConstructOptions,
      callback: Listener.ConstructCallback<this>,
    ): void

    respondPattern(regex: RegExp): RegExp

    enter(callback: (response: Response<this>) => void): void
    enter(
      options: Listener.ConstructOptions,
      callback: (response: Response<this>) => void,
    ): void

    leave(callback: (response: Response<this>) => void): void
    leave(
      options: Listener.ConstructOptions,
      callback: (response: Response<this>) => void,
    ): void

    topic(callback: (response: Response<this>) => void): void
    topic(
      options: Listener.ConstructOptions,
      callback: (response: Response<this>) => void,
    ): void

    catchAll(callback: (response: Response<this>) => void): void
    catchAll(
      options: Listener.ConstructOptions,
      callback: (response: Response<this>) => void,
    ): void

    receive(message: Message): void

    error(callback: (error: Error) => void): void

    listenerMiddleware(middleware: Middleware<this>): void

    responseMiddleware(middleware: Middleware<this>): void

    receiveMiddleware(middleware: Middleware<this>): void

    loadFile(filepath: string, filename: string): void

    load(path: string): void

    loadHubotScripts(path: string, scripts: string[]): void

    loadExternalScripts(packages: string[] | { [pkg: string]: any }): void

    helpCommands(): string[]

    send(envelope: Envelope, ...messages: string[]): void

    reply(envelope: Envelope, ...messages: string[]): void

    messageRoom(room: Envelope['room'], ...messages: string[]): void

    on: EventEmitter['on']

    emit: EventEmitter['emit']

    run(): void

    shutdown(): void

    parseVersion(): string

    http(url: string, options: HttpClient.Options): HttpClient.ScopedClient
  }

  export class Robot<A extends Adapter> implements Robot<A> {
    constructor(
      adapterPath: string,
      adapter: string,
      httpd?: boolean,
      name?: string,
      alias?: string,
    )

    private parseHelp(path: string): void
  }

  export default Robot
}

declare module 'hubot/src/user' {
  import Robot from 'hubot/src/robot'

  export interface PlainUser {
    id: any
    name: string
    room: string
  }

  export interface User extends PlainUser {
    set(key: string, value: any): void
    get(key: string): any
  }

  export interface ContructOptions<ROBOT extends Robot<any> = Robot<any>> {
    robot?: ROBOT
    [key: string]: any
  }

  export class User<ROBOT extends Robot<any> = Robot<any>> implements User {
    constructor(id: PlainUser['id'], options?: ContructOptions<ROBOT>)
  }

  export default User
}
