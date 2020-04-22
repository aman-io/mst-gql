import { IAnyModelType, IReferenceType } from "mobx-state-tree";
export declare function MSTGQLRef<T extends IAnyModelType>(targetType: T): IReferenceType<T>;
export declare const MSTGQLObject: import("mobx-state-tree").IModelType<{}, {
    __setStore(s: {
        __queryCache: import("mobx-state-tree").IMSTMap<import("mobx-state-tree").IType<any, any, any>> & import("mobx-state-tree").IStateTreeNode<import("mobx-state-tree").IOptionalIType<import("mobx-state-tree").IMapType<import("mobx-state-tree").IType<any, any, any>>, [undefined]>>;
    } & import("mobx-state-tree/dist/internal").NonEmptyObject & {
        ssr: boolean;
        __promises: Map<string, Promise<unknown>>;
        __afterInit: boolean;
    } & {
        merge: (data: unknown) => any;
        deflate: (data: unknown) => any;
        mutate: <T>(mutation: string | import("graphql").DocumentNode, variables?: any, optimisticUpdate?: (() => void) | undefined, checkError?: ((result: T) => boolean) | undefined) => import("./Query").Query<T>;
        query: <T_1>(query: string | import("graphql").DocumentNode, variables?: any, options?: import("./Query").QueryOptions) => import("./Query").Query<T_1>;
        subscribe: <T_2 = any>(query: string | import("graphql").DocumentNode, variables?: any, onData?: ((item: T_2) => void) | undefined) => () => void;
        rawRequest: (query: string, variables: any) => Promise<any>;
        __pushPromise(promise: Promise<{}>, queryKey: string): void;
        __runInStoreContext<T_3>(fn: () => T_3): T_3;
        __cacheResponse(key: string, response: any): void;
        __onAfterInit(): void;
    } & import("mobx-state-tree").IStateTreeNode<import("mobx-state-tree").IModelType<{
        __queryCache: import("mobx-state-tree").IOptionalIType<import("mobx-state-tree").IMapType<import("mobx-state-tree").IType<any, any, any>>, [undefined]>;
    }, {
        ssr: boolean;
        __promises: Map<string, Promise<unknown>>;
        __afterInit: boolean;
    } & {
        merge: (data: unknown) => any;
        deflate: (data: unknown) => any;
        mutate: <T>(mutation: string | import("graphql").DocumentNode, variables?: any, optimisticUpdate?: (() => void) | undefined, checkError?: ((result: T) => boolean) | undefined) => import("./Query").Query<T>;
        query: <T_1>(query: string | import("graphql").DocumentNode, variables?: any, options?: import("./Query").QueryOptions) => import("./Query").Query<T_1>;
        subscribe: <T_2 = any>(query: string | import("graphql").DocumentNode, variables?: any, onData?: ((item: T_2) => void) | undefined) => () => void;
        rawRequest: (query: string, variables: any) => Promise<any>;
        __pushPromise(promise: Promise<{}>, queryKey: string): void;
        __runInStoreContext<T_3>(fn: () => T_3): T_3;
        __cacheResponse(key: string, response: any): void;
        __onAfterInit(): void;
    }, import("mobx-state-tree")._NotCustomized, import("mobx-state-tree")._NotCustomized>>): void;
} & {
    __getStore<T_4>(): T_4;
    hasLoaded(key: string): boolean;
}, import("mobx-state-tree")._NotCustomized, import("mobx-state-tree")._NotCustomized>;
