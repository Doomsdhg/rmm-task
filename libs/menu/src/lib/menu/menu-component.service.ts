import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, ItemInterface, generateRandomItem } from '@rmm-task/api';
import { BehaviorSubject, ReplaySubject, filter, first, fromEvent, map, switchMap, timer, withLatestFrom } from 'rxjs';

enum EKey {
  ARROW_LEFT = 'ArrowLeft',
  ARROW_RIGHT = 'ArrowRight',
  ARROW_UP = 'ArrowUp',
  ARROW_DOWN = 'ArrowDown',
  BACKSPACE = 'Backspace',
  ENTER = 'Enter'
}

// установление положения текущего юнита после удаления
const getNextCurrentUnit = ([take_next, current_app, apps]: [boolean, ItemInterface | undefined, ItemInterface[]]) => {
  if (current_app === undefined) {
    return apps[0];
  }

  const current_app_index = apps.findIndex((app) => current_app.id === app.id),
        current_app_is_first = current_app_index === 0,
        current_app_is_last = current_app_index === apps.length - 1;

  let next_current_app_index: number;

  if (take_next) {
    next_current_app_index = current_app_is_last ? 0 : current_app_index + 1;
  } else {
    next_current_app_index = current_app_is_first ? apps.length - 1 : current_app_index - 1;
  }

  return apps[next_current_app_index];
};

// функция для нахождения положения текущего юнита после нажатия на клавиши стрелочек на клавиатуре
const movePointer = ([key, current_app, apps, columns_count]: [EKey, ItemInterface | undefined, ItemInterface[], number]) => {
  const current_app_index = apps.findIndex((app) => current_app?.id === app.id),
        last_index = apps.length - 1,
        current_app_is_first = current_app_index === 0,
        current_app_is_last = current_app_index === last_index;

  let next_current_app_index: number;

  switch (key) {
    case EKey.ARROW_DOWN: {
      const offset_greater_than_last_index = current_app_index + columns_count > last_index;
      next_current_app_index = offset_greater_than_last_index ? current_app_index % columns_count : current_app_index + columns_count;
      break;
    }
    case EKey.ARROW_UP: {
      const offset_less_than_first_index = current_app_index - columns_count < 0;
      if (offset_less_than_first_index) {
        const rows: Array<ItemInterface[]> = [];

        for (let i = 0; i <= apps.length; i += columns_count) {
          rows.push(apps.slice(i, apps.length - i < columns_count ? apps.length : i + columns_count));
        }

        const app_index_in_row = current_app_index % columns_count;
        const next_current_app = rows?.[rows.length - 1]?.[app_index_in_row] || rows?.[rows.length - 2]?.[app_index_in_row];
        next_current_app_index = apps.findIndex((a) => a.id === next_current_app?.id);
      } else {
        next_current_app_index = current_app_index - columns_count;
      }
      break;
    }
    case EKey.ARROW_LEFT: {
      next_current_app_index = current_app_is_first ? last_index : current_app_index - 1;
      break;
    }
    case EKey.ARROW_RIGHT: {
      next_current_app_index = current_app_is_last ? 0 : current_app_index + 1;
      break;
    }
    default: {
      next_current_app_index = 0;
    }
  }

  return apps[next_current_app_index];
}

@Injectable()
export class MenuComponentService {
  public apps$ = new ReplaySubject<ItemInterface[]>(1);
  public current_app$ = new BehaviorSubject<ItemInterface | undefined>(undefined);
  public columns_count$ = new ReplaySubject<number>(1);

  constructor(private readonly api_service: ApiService){
    timer(0, 10000)
      .pipe(
        switchMap(() => this.api_service.getAllItems$()),
        takeUntilDestroyed()
      )
      .subscribe(this.apps$);

    // выбор текущего приложения стрелочками на клавиатуре
    fromEvent(window, 'keyup')
      .pipe(
        map((e) => (e as KeyboardEvent)?.key as EKey),
        filter((key) => [EKey.ARROW_LEFT, EKey.ARROW_RIGHT, EKey.ARROW_DOWN, EKey.ARROW_UP].includes(key)),
        withLatestFrom(this.current_app$, this.apps$, this.columns_count$),
        map(movePointer),
        takeUntilDestroyed(),
      )
      .subscribe(this.current_app$);

    // удаление текущего приложения нажатием на backspace
    fromEvent(window, 'keyup')
      .pipe(
        map((e) => (e as KeyboardEvent)?.key as EKey),
        filter((key) => key === EKey.BACKSPACE),
        withLatestFrom(this.current_app$, this.apps$),
        filter(([_, current_app, apps]) => !!current_app && !!apps.length),
        takeUntilDestroyed()
      )
      .subscribe(() => this.deleteCurrentApp());

    // показ алерта при нажатии на enter
    fromEvent(window, 'keyup')
      .pipe(
        map((e) => (e as KeyboardEvent)?.key as EKey),
        filter((key) => key === EKey.ENTER),
        withLatestFrom(this.current_app$, this.apps$),
        filter(([_, current_app, apps]) => !!current_app && !!apps.length),
        takeUntilDestroyed()
      )
      .subscribe(([_, app]) => this.showAppAlert((app as ItemInterface).name));
  }

  public addRandomApp(): void {
    this.api_service.addNewItem$(generateRandomItem())
      .pipe(
        withLatestFrom(this.apps$),
        map(([new_app, apps]) => [...apps, new_app])
      )
      .subscribe((apps) => this.apps$.next(apps));
  }

  public deleteCurrentApp(): void {
    this.current_app$
      .pipe(
        first(),
        filter((current_app) => !!current_app),
        switchMap((app_to_delete) =>
          this.api_service.deleteItem$(app_to_delete as ItemInterface)
            .pipe(
              withLatestFrom(this.apps$),
              map(
                ([_, apps]) => [
                  apps.findIndex((app) => app.id === app_to_delete?.id) !== apps.length - 1,
                  app_to_delete as ItemInterface,
                  apps
                ] as [boolean, ItemInterface | undefined, ItemInterface[]]
              ),
              map(
                ([next, current_app, apps]) => [
                  apps.filter((a) => a.id !== (app_to_delete as ItemInterface).id),
                  getNextCurrentUnit([next, current_app, apps])] as [ItemInterface[], ItemInterface | undefined
                ]
              )
            )
        ),
      )
      .subscribe(([apps, next_unit]) => {
        this.apps$.next(apps);
        this.current_app$.next(next_unit);
      });
  }

  private showAppAlert(app_name: string) {
    alert(`Приложение ${app_name} запущено!`);
  }
}
