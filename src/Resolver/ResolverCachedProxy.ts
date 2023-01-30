import SI from "@config/inversify.types";
import CacheInterface from "@src/Components/Cache/CacheInterface";
import CacheItemInterface from "@src/Components/Cache/CacheItemInterface";
import Event from "@src/Components/EventDispatcher/Event";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import ResolverInterface from "@src/Interfaces/ResolverInterface";
import { inject, injectable, named } from "inversify";
import { ResolverEvents } from "./ResolverType";
import { AppEvents } from "@src/Types";
@injectable()
export default class ResolverCachedProxy implements ResolverInterface {
    constructor(
        @inject(SI.resolver)
        @named("original")
        private resolver: ResolverInterface,
        @inject(SI.cache)
        private cache: CacheInterface,
        @inject(SI["event:dispatcher"])
        private dispatcher: EventDispatcherInterface<ResolverEvents & AppEvents>
    ) {
        dispatcher.addListener({ name: "resolver:clear", cb: () => this.cache.clear() });
        dispatcher.addListener({ name: "metadata:cache:changed", cb: e => this.handleDelete(e.get().path) });
        dispatcher.addListener({
            name: "file:rename",
            cb: e => {
                this.cache.delete(e.get().old);
                this.handleDelete(e.get().actual);
            },
        });
    }

    private handleDelete(path: string): void {
        const item = this.cache.getItem<string | null>(path);

        if (!item.isHit()) {
            return;
        }
        const old = item.get();
        this.actualize(item);

        if (old !== item.get()) {
            this.dispatcher.dispatch("resolver:unresolved", new Event({ path }));
        }
    }

    resolve(path: string): string {
        return this.get(path);
    }

    private actualize(item: CacheItemInterface<string | null>): void {
        const title = this.resolver.resolve(item.getKey());
        this.cache.save(item.set(title));
    }

    private get(path: string): string | null {
        const item = this.cache.getItem<string | null>(path);
        if (item.isHit() === false) {
            this.actualize(item);
        }
        return item.get() ?? null;
    }
}
