/* @ds-bundle: {"format":4,"namespace":"Sobanderia","components":[{"name":"Icon"},{"name":"Button"},{"name":"IconButton"},{"name":"AppointmentRow"},{"name":"NextAppointmentCard"},{"name":"StatusNote"},{"name":"ScreenHeader"},{"name":"BottomNav"},{"name":"OptionRow"},{"name":"TimeSlot"},{"name":"TextField"},{"name":"ConfirmationCard"},{"name":"StepHeader"},{"name":"SummaryCard"},{"name":"CheckboxField"},{"name":"BackHeader"},{"name":"DayChip"},{"name":"EmptyState"},{"name":"Switch"},{"name":"PasswordField"},{"name":"Skeleton"}]} */
(function () {
  'use strict';
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i]) out.push(arguments[i]);
    }
    return out.join(' ');
  }

  var SHAPES = {
    phone: [['path', { d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z' }]],
    chat: [['path', { d: 'M4 20l1.3-4.2A8 8 0 1 1 8.2 18.7L4 20z' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
    x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    'calendar-check': [
      ['rect', { x: 4, y: 5, width: 16, height: 15, rx: 2 }],
      ['path', { d: 'M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4' }]
    ],
    'calendar-week': [
      ['rect', { x: 4, y: 5, width: 16, height: 15, rx: 2 }],
      ['path', { d: 'M8 3v4M16 3v4M4 10h16M10 10v10' }]
    ],
    users: [
      ['circle', { cx: 9, cy: 8, r: 3.2 }],
      ['path', { d: 'M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5M16 5a3 3 0 0 1 0 6M18 14.8c1.8.7 3 2.4 3 5.2' }]
    ],
    clock: [
      ['circle', { cx: 12, cy: 12, r: 8.5 }],
      ['path', { d: 'M12 7.5V12l3 2' }]
    ]
  };

  function Icon(props) {
    var size = props.size || 22;
    var shapes = SHAPES[props.name] || [];
    return h(
      'svg',
      {
        className: cx('sb-icon', props.className),
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false'
      },
      shapes.map(function (s, i) {
        return h(s[0], Object.assign({ key: i }, s[1]));
      })
    );
  }

  function Button(props) {
    var variant = props.variant || 'solid';
    var size = props.size || 'lg';
    var variantClass = variant === 'onBrand' ? 'onbrand' : variant;
    return h(
      'button',
      {
        type: props.type || 'button',
        className: cx('sb-button', 'sb-button--' + size, 'sb-button--' + variantClass, 'body-lg', props.className),
        style: props.style,
        onClick: props.onClick,
        disabled: props.disabled
      },
      props.icon ? h(Icon, { name: props.icon }) : null,
      props.children
    );
  }

  function IconButton(props) {
    return h(
      'button',
      {
        type: 'button',
        className: cx('sb-icon-button', props.className),
        style: props.style,
        onClick: props.onClick,
        'aria-label': props.label
      },
      h(Icon, { name: props.icon })
    );
  }

  function AppointmentRow(props) {
    return h(
      'div',
      { className: cx('sb-row', props.className), style: props.style },
      h(
        'div',
        { className: 'sb-row__time' },
        h('span', { className: 'display-md' }, props.time),
        h('span', { className: 'micro sb-muted' }, props.meridiem)
      ),
      h(
        'div',
        { className: 'sb-row__main' },
        h('span', { className: 'body-lg' }, props.name),
        h('span', { className: 'caption sb-muted' }, props.duration || '30 min')
      ),
      h(IconButton, { icon: 'phone', label: 'Llamar a ' + props.name, onClick: props.onCall })
    );
  }

  function NextAppointmentCard(props) {
    var label = props.label || 'Siguiente cita';
    return h(
      'section',
      { className: cx('sb-next', props.className), style: props.style, 'aria-label': label },
      h(
        'div',
        { className: 'sb-next__top' },
        h('span', { className: 'label sb-next__label' }, label),
        props.countdown ? h('span', { className: 'caption-strong sb-next__pill' }, props.countdown) : null
      ),
      h(
        'div',
        { className: 'sb-next__body' },
        h('div', { className: 'display-xl' }, props.time, ' ', h('span', { className: 'sb-next__meridiem' }, props.meridiem)),
        h('div', { className: 'title-lg sb-next__name' }, props.name),
        props.detail ? h('div', { className: 'body' }, props.detail) : null
      ),
      h(
        'div',
        { className: 'sb-next__actions' },
        h(Button, { variant: 'onBrand', size: 'md', icon: 'phone', onClick: props.onCall }, 'Llamar'),
        h(Button, { variant: 'onBrand', size: 'md', icon: 'chat', onClick: props.onChat }, 'WhatsApp')
      )
    );
  }

  function StatusNote(props) {
    return h(
      'div',
      { className: cx('sb-status', 'label', props.className), style: props.style },
      h(Icon, { name: props.icon || 'check' }),
      h('span', null, props.children)
    );
  }

  function ScreenHeader(props) {
    return h(
      'header',
      { className: cx('sb-header', props.className), style: props.style },
      h(
        'div',
        { className: 'sb-header__text' },
        h('span', { className: 'label sb-muted' }, props.date),
        h('h1', { className: 'display-lg sb-header__title' }, props.title)
      ),
      props.initial ? h('div', { className: 'sb-avatar display-sm', 'aria-hidden': 'true' }, props.initial) : null
    );
  }

  var DEFAULT_NAV = [
    { id: 'today', label: 'Hoy', icon: 'calendar-check' },
    { id: 'week', label: 'Semana', icon: 'calendar-week' },
    { id: 'clients', label: 'Clientes', icon: 'users' },
    { id: 'schedule', label: 'Mi horario', icon: 'clock' }
  ];

  function BottomNav(props) {
    var items = props.items || DEFAULT_NAV;
    return h(
      'nav',
      { className: cx('sb-nav', props.className), style: props.style, 'aria-label': props.label || 'Navegación principal' },
      items.map(function (item) {
        var on = item.id === props.active;
        return h(
          'button',
          {
            key: item.id,
            type: 'button',
            className: 'sb-nav__item micro',
            'aria-current': on ? 'page' : undefined,
            onClick: function () {
              if (props.onSelect) props.onSelect(item.id);
            }
          },
          h(Icon, { name: item.icon, size: 24 }),
          item.label
        );
      })
    );
  }

  function OptionRow(props) {
    var trailing = props.trailing || 'chevron';
    var hasLead = !!(props.icon || props.initial);
    var lead = null;
    if (props.icon) {
      lead = h('span', { className: 'sb-option__lead sb-option__lead--icon', 'aria-hidden': 'true' }, h(Icon, { name: props.icon }));
    } else if (props.initial) {
      lead = h('span', { className: 'sb-option__lead sb-option__lead--avatar display-sm', 'aria-hidden': 'true' }, props.initial);
    }
    var end = null;
    if (trailing === 'chevron') {
      end = h(
        'span',
        { className: 'sb-option__chevron', 'aria-hidden': 'true' },
        h(
          'svg',
          { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false' },
          h('path', { d: 'M9 6l6 6-6 6' })
        )
      );
    } else if (trailing === 'radio' && !props.disabled) {
      end = props.selected
        ? h('span', { className: 'sb-option__radio sb-option__radio--on', 'aria-hidden': 'true' }, h(Icon, { name: 'check' }))
        : h('span', { className: 'sb-option__radio', 'aria-hidden': 'true' });
    }
    return h(
      'button',
      {
        type: 'button',
        className: cx('sb-option', hasLead && 'sb-option--lead', (props.selected || props.highlight) && 'sb-option--selected', props.className),
        style: props.style,
        onClick: props.onClick,
        disabled: props.disabled,
        'aria-pressed': props.selected === undefined ? undefined : props.selected ? 'true' : 'false'
      },
      lead,
      h(
        'span',
        { className: 'sb-option__text' },
        h('span', { className: 'body-lg' }, props.title),
        props.caption ? h('span', { className: 'caption sb-option__caption' }, props.caption) : null
      ),
      end
    );
  }

  function TimeSlot(props) {
    return h(
      'button',
      {
        type: 'button',
        className: cx('sb-slot', props.selected && 'sb-slot--selected', props.className),
        style: props.style,
        onClick: props.onClick,
        'aria-pressed': props.selected ? 'true' : 'false'
      },
      h('span', { className: 'body-lg' }, props.time),
      h('span', { className: 'micro' }, props.meridiem)
    );
  }

  function TextField(props) {
    var id = props.id || 'sb-field-' + String(props.label || 'campo').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var controlled = props.value !== undefined;
    return h(
      'div',
      { className: cx('sb-field', props.className), style: props.style },
      h('label', { className: 'label', htmlFor: id }, props.label),
      h('input', {
        id: id,
        className: cx('sb-field__input', 'body-lg', props.error && 'sb-field__input--error'),
        'aria-invalid': props.error ? 'true' : undefined,
        'aria-describedby': props.error ? id + '-error' : undefined,
        type: props.type || 'text',
        inputMode: props.inputMode,
        autoComplete: props.autoComplete,
        placeholder: props.placeholder,
        value: props.value,
        defaultValue: props.defaultValue,
        onChange: props.onChange,
        readOnly: controlled && !props.onChange ? true : undefined
      }),
      props.error
        ? h('span', { id: id + '-error', className: 'caption sb-field__error', role: 'alert' }, props.error)
        : props.helper ? h('span', { className: 'caption sb-muted' }, props.helper) : null
    );
  }

  function StepHeader(props) {
    var total = props.total || 4, step = props.step || 1, i, segs = [];
    for (i = 1; i <= total; i++) {
      segs.push(h('div', { key: i, className: cx('sb-steps__seg', i <= step && 'sb-steps__seg--on') }));
    }
    return h(
      'header',
      { className: cx('sb-stephead', props.className), style: props.style },
      h(
        'div',
        { className: 'sb-stephead__row' },
        (props.showBack !== undefined ? props.showBack : step > 1)
          ? h('button', { type: 'button', className: 'sb-stephead__back body-lg', onClick: props.onBack },
              h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, h('path', { d: 'M15 6l-6 6 6 6' })),
              'Atrás')
          : h('span', { className: 'section-title sb-stephead__brand' }, props.brand || 'Sobandería'),
        h('span', { className: 'label sb-muted' }, 'Paso ' + step + ' de ' + total)
      ),
      h('div', { className: 'sb-steps', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': total, 'aria-valuenow': step, 'aria-label': 'Paso ' + step + ' de ' + total }, segs)
    );
  }

  function SummaryCard(props) {
    var items = props.items || [];
    return h(
      'section',
      { className: cx('sb-summary', props.className), style: props.style, 'aria-label': props.label || 'Resumen de su cita' },
      items.map(function (it, i) {
        return h('div', { key: i, className: 'sb-summary__row' }, h(Icon, { name: it.icon }), h('span', { className: 'body-lg' }, it.text));
      })
    );
  }

  function CheckboxField(props) {
    var id = props.id || 'sb-check-' + String(props.label || 'casilla').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
    var controlled = props.checked !== undefined;
    return h(
      'div',
      { className: cx('sb-check', props.className), style: props.style },
      h('input', {
        id: id, type: 'checkbox', className: 'sb-check__box',
        checked: props.checked, defaultChecked: props.defaultChecked, onChange: props.onChange,
        readOnly: controlled && !props.onChange ? true : undefined,
        'aria-invalid': props.error ? 'true' : undefined
      }),
      h('label', { htmlFor: id, className: 'caption sb-check__label' }, props.label, props.linkText ? [' ', h('span', { key: 'l', className: 'sb-check__link' }, props.linkText)] : null),
      props.error ? h('span', { className: 'caption sb-field__error sb-check__error', role: 'alert' }, props.error) : null
    );
  }

  function ConfirmationCard(props) {
    var label = props.label || 'Su cita';
    return h(
      'section',
      { className: cx('sb-confirm', props.className), style: props.style, 'aria-label': label },
      h('span', { className: 'label sb-confirm__label' }, label),
      h('div', { className: 'display-xl' }, props.time, ' ', h('span', { className: 'sb-confirm__meridiem' }, props.meridiem)),
      h(
        'div',
        { className: 'sb-confirm__text' },
        h('span', { className: 'title-lg' }, props.title),
        props.detail ? h('span', { className: 'body' }, props.detail) : null
      )
    );
  }


  function BackHeader(props) {
    return h(
      'header',
      { className: cx('sb-backhead', props.className), style: props.style },
      h('button', { type: 'button', className: 'sb-stephead__back body-lg', onClick: props.onBack },
        h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, h('path', { d: 'M15 6l-6 6 6 6' })),
        props.label || 'Atrás')
    );
  }

  function DayChip(props) {
    return h(
      'button',
      {
        type: 'button',
        className: cx('sb-daychip', props.selected && 'sb-daychip--selected', props.className),
        style: props.style,
        'aria-pressed': props.selected ? 'true' : 'false',
        'aria-label': props.label,
        onClick: props.onClick
      },
      h('span', { className: 'micro' }, props.day),
      h('span', { className: 'body-lg' }, props.date)
    );
  }

  function EmptyState(props) {
    return h(
      'section',
      { className: cx('sb-empty', props.className), style: props.style, 'aria-label': props.title },
      h('h2', { className: 'title-lg sb-empty__title' }, props.title),
      props.text ? h('p', { className: 'body sb-muted sb-empty__text' }, props.text) : null
    );
  }

  function Switch(props) {
    var id = props.id || 'sb-switch-' + String(props.label || 'opcion').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
    var controlled = props.checked !== undefined;
    return h(
      'div',
      { className: cx('sb-switch', props.className), style: props.style },
      h('label', { htmlFor: id, className: 'body-lg sb-switch__label' }, props.label),
      h('input', {
        id: id, type: 'checkbox', role: 'switch', className: 'sb-switch__input',
        checked: props.checked, defaultChecked: props.defaultChecked, onChange: props.onChange,
        readOnly: controlled && !props.onChange ? true : undefined
      })
    );
  }

  function PasswordField(props) {
    var shown = React.useState(false);
    var id = props.id || 'sb-field-' + String(props.label || 'clave').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var controlled = props.value !== undefined;
    return h(
      'div',
      { className: cx('sb-field', props.className), style: props.style },
      h('label', { className: 'label', htmlFor: id }, props.label),
      h(
        'div',
        { className: 'sb-pass' },
        h('input', {
          id: id,
          className: cx('sb-field__input', 'body-lg', 'sb-pass__input', props.error && 'sb-field__input--error'),
          type: shown[0] ? 'text' : 'password',
          autoComplete: props.autoComplete || 'current-password',
          value: props.value, defaultValue: props.defaultValue, onChange: props.onChange,
          readOnly: controlled && !props.onChange ? true : undefined,
          'aria-invalid': props.error ? 'true' : undefined,
          'aria-describedby': props.error ? id + '-error' : undefined
        }),
        h('button', { type: 'button', className: 'sb-pass__toggle label', 'aria-pressed': shown[0] ? 'true' : 'false', onClick: function () { shown[1](!shown[0]); } }, shown[0] ? 'Ocultar' : 'Mostrar')
      ),
      props.error
        ? h('span', { id: id + '-error', className: 'caption sb-field__error', role: 'alert' }, props.error)
        : props.helper ? h('span', { className: 'caption sb-muted' }, props.helper) : null
    );
  }

  function Skeleton(props) {
    return h('div', { className: cx('sb-skel', props.className), 'aria-hidden': 'true', style: Object.assign({ width: props.width || '100%', height: props.height || 60 }, props.style) });
  }

  window.Sobanderia = {
    Icon: Icon,
    Button: Button,
    IconButton: IconButton,
    AppointmentRow: AppointmentRow,
    NextAppointmentCard: NextAppointmentCard,
    StatusNote: StatusNote,
    ScreenHeader: ScreenHeader,
    BottomNav: BottomNav,
    OptionRow: OptionRow,
    TimeSlot: TimeSlot,
    TextField: TextField,
    ConfirmationCard: ConfirmationCard,
    StepHeader: StepHeader,
    SummaryCard: SummaryCard,
    CheckboxField: CheckboxField,
    BackHeader: BackHeader,
    DayChip: DayChip,
    EmptyState: EmptyState,
    Switch: Switch,
    PasswordField: PasswordField,
    Skeleton: Skeleton
  };
})();
