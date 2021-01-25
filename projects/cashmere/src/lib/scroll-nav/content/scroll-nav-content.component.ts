import {
    Component,
    ViewEncapsulation,
    Input,
    AfterViewInit,
    ViewChild,
    OnDestroy,
    EventEmitter,
    Output,
    ContentChildren,
    HostListener,
    AfterViewChecked
} from '@angular/core';
import type {QueryList} from '@angular/core';
import {CdkScrollable} from '@angular/cdk/scrolling';
import {Subject} from 'rxjs';
import {HcScrollNavComponent} from '../nav/scroll-nav.component';
import {takeUntil} from 'rxjs/operators';
import {ScrollNavTargetDirective} from './scroll-nav-target.directive';

/** Contains scrollable content that is navigable via `hc-scroll-nav` links. */
@Component({
    selector: 'hc-scroll-nav-content',
    encapsulation: ViewEncapsulation.None,
    styleUrls: ['scroll-nav-content.component.scss'],
    templateUrl: 'scroll-nav-content.component.html'
})
export class HcScrollNavContentComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
    private readonly DEFAULT_BUFFER = 0;
    /** Reference to the scroll nav component. */
    @Input() public nav: HcScrollNavComponent;
    /** If true, will force the height of the final scroll target area to be the height of the scrollable container.
     * This is helpful if you want the last target in the content area to be able to scroll to the top. You can alternatively
     * target the last item with css. *Defaults to true.* */
    @Input() public makeLastTargetFullHeight = true;
    /** Number in pixels, used to give a little leeway in the shifting of the active nav when scrolling. *Defaults to 0.*
     * Example: If set to 40, if showing just the bottom 40 pixels of the section before, count the next section as active. */
    @Input() public bufferSpace = this.DEFAULT_BUFFER;
    /** If true, applies smooth scrolling via css. *Defaults to true.* */
    @Input() public shouldAnimateScroll = true;
    /** Fires when a new section is scrolled into view. Broadcasts the id of that section. */
    @Output() public newSectionInView: EventEmitter<string> = new EventEmitter<string>();
    @ViewChild('scrollContainer', {read: CdkScrollable, static: false}) public _cdkScrollableElement: CdkScrollable;
    @ContentChildren(ScrollNavTargetDirective, { descendants: true }) private targets: QueryList<ScrollNavTargetDirective>;
    /** Id of the current section scrolled into view. */
    public sectionInView: string;
    public get _scrollTargets(): Array<HTMLElement> {
        return this.targets.toArray().map(e => e._el.nativeElement);
    }

    private unsubscribe$ = new Subject<void>();
    private minHeightForLastTargetSet = false;

    public ngOnDestroy(): void {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    public ngAfterViewInit(): void {
        if (this._cdkScrollableElement) {
            this._cdkScrollableElement
                .elementScrolled()
                .pipe(takeUntil(this.unsubscribe$))
                .subscribe(() => {
                    this.checkActiveSection();
                });
        }

        this._scrollTargets.forEach((target) => {
            if (!target.id) {
                throw Error('hcScrollTarget element needs an id.');
            }
        });
    }

    public ngAfterViewChecked(): void {
        if (this.makeLastTargetFullHeight && !this.minHeightForLastTargetSet) {
            this.insureMinHeightForLastTarget();
        }
    }

    @HostListener('window:resize') _onWindowResize() {
        if (this.makeLastTargetFullHeight) {
            this.minHeightForLastTargetSet = false;
        }
    }

    /** Scroll to top and reset the 'automatic full height for the last item' setting. */
    public refresh() {
        this.scrollToTop();
        this.minHeightForLastTargetSet = false;
    }

    /** Helper function to scroll to the top of the content area. */
    public scrollToTop() {
        this._cdkScrollableElement.scrollTo({top: 0});
    }

    /** Will update the navigation state. */
    public checkActiveSection() {
        let offset: number = this._cdkScrollableElement.measureScrollOffset('top') + this._scrollTargets[0].offsetTop;

        this._scrollTargets.forEach((target, index) => {
            const el = target;
            let initialOffset = 0;
            let nextOffset = 0;

            if (index > 0) {
                initialOffset = el.offsetTop - this.bufferSpace;
            }
            if (index + 1 < this._scrollTargets.length) {
                const nextEl = this._scrollTargets[index + 1];
                nextOffset = nextEl.offsetTop;
            }

            if (
                (initialOffset && nextOffset && offset >= initialOffset && offset < nextOffset) ||
                (initialOffset && !nextOffset && offset >= initialOffset) ||
                (!initialOffset && nextOffset && offset < nextOffset)
            ) {
                this.setActiveSection(el.getAttribute('id') || '');
            }
        });
    }

    private getTargets(targets: HTMLElement[]): HTMLElement[] {
        let rtnTargets: HTMLElement[] = [];

        targets.forEach((target) => {
            if (target.hasAttribute('hcScrollTarget')) {
                rtnTargets.push(target);
            }

            if (target.children.length > 0) {
                rtnTargets = rtnTargets.concat(this.getTargets(<Array<HTMLElement>>Array.from(target.children)));
            }
        });

        return rtnTargets;
    }

    private insureMinHeightForLastTarget() {
        const containerHeight = this._cdkScrollableElement.getElementRef().nativeElement.offsetHeight;
        if (containerHeight && this._scrollTargets.length > 0) {
            const targetEl = this._scrollTargets[this._scrollTargets.length - 1];
            targetEl.style.minHeight = `${containerHeight + 50}px`;
            this.minHeightForLastTargetSet = true;
        }
    }

    private setActiveSection(scrollTarget: string): void {
        if (this.sectionInView !== scrollTarget) {
            this.sectionInView = scrollTarget;
            this.nav._setActiveSectionById(scrollTarget);
            this.newSectionInView.next(scrollTarget);
        }
    }
}
