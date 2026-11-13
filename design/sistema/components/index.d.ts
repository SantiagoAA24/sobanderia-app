/** Nombres de icono disponibles en <Icon />. */
export type IconName = 'phone' | 'chat' | 'plus' | 'check' | 'x' | 'calendar-check' | 'calendar-week' | 'users' | 'clock';

export interface IconProps {
  name: IconName;
  /** Lado en px. Por defecto 22; la barra inferior usa 24. */
  size?: number;
}

export interface ButtonProps {
  /** 'solid' (tinta), 'outline' (contorno) u 'onBrand' (blanco, solo sobre la tarjeta terracota). */
  variant?: 'solid' | 'outline' | 'onBrand';
  /** 'lg' = 56px; 'md' = 52px. */
  size?: 'lg' | 'md';
  icon?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  /** El texto del botón. Siempre una palabra o frase corta. */
  children: React.ReactNode;
}

export interface IconButtonProps {
  icon: IconName;
  /** Obligatorio: el botón no tiene texto visible. */
  label: string;
  onClick?: () => void;
}

export interface AppointmentRowProps {
  /** Hora sin 'a. m.', por ejemplo "10:30". */
  time: string;
  /** "a. m." o "p. m." */
  meridiem: string;
  name: string;
  /** Por defecto "30 min". */
  duration?: string;
  onCall?: () => void;
}

export interface NextAppointmentCardProps {
  time: string;
  meridiem: string;
  name: string;
  /** Por ejemplo "Sesión de 30 minutos". */
  detail?: string;
  /** Por ejemplo "En 10 min". */
  countdown?: string;
  /** Por defecto "Siguiente cita". */
  label?: string;
  onCall?: () => void;
  onChat?: () => void;
}

export interface StatusNoteProps {
  /** Por defecto 'check'. */
  icon?: IconName;
  children: React.ReactNode;
}

export interface ScreenHeaderProps {
  /** Por ejemplo "Jueves 12 de noviembre". */
  date: string;
  /** Por ejemplo "Buenos días, Carlos". */
  title: string;
  /** Inicial del avatar; sin ella no se dibuja. */
  initial?: string;
}

export interface BottomNavItem {
  id: string;
  label: string;
  icon: IconName;
}

export interface OptionRowProps {
  /** Texto principal de la opción, por ejemplo "Carlos" o "Viernes 13 de noviembre". */
  title: string;
  /** Línea secundaria, por ejemplo "Próximo cupo: hoy, 10:30 a. m.". */
  caption?: string;
  /** Inicial dentro de un avatar a la izquierda. */
  initial?: string;
  /** Icono dentro de un círculo a la izquierda (tiene prioridad sobre `initial`). */
  icon?: IconName;
  /** 'chevron' (por defecto) para pasar a otra pantalla; 'radio' para elegir entre opciones; 'none'. */
  trailing?: 'chevron' | 'radio' | 'none';
  /** Marca la opción elegida; añade aria-pressed. */
  selected?: boolean;
  /** Resalta la fila sin marcarla como elegida (por ejemplo "Primer turno disponible"). */
  highlight?: boolean;
  /** Sin disponibilidad: fondo arena y no se puede tocar. */
  disabled?: boolean;
  onClick?: () => void;
}

export interface TimeSlotProps {
  /** Hora sin 'a. m.', por ejemplo "10:30". */
  time: string;
  /** "a. m." o "p. m." */
  meridiem: string;
  selected?: boolean;
  onClick?: () => void;
}

export interface TextFieldProps {
  /** Etiqueta visible sobre el campo; obligatoria. */
  label: string;
  value?: string;
  defaultValue?: string;
  /** Texto de ayuda bajo el campo. */
  helper?: string;
  placeholder?: string;
  /** 'text' (por defecto), 'tel', 'email'… */
  type?: string;
  inputMode?: 'text' | 'tel' | 'numeric' | 'email';
  autoComplete?: string;
  id?: string;
  /** Mensaje de error: pinta el borde en brand-deep y reemplaza la ayuda. */
  error?: string;
  onChange?: (event: unknown) => void;
}

export interface ConfirmationCardProps {
  /** Por defecto "Su cita". */
  label?: string;
  time: string;
  meridiem: string;
  /** Fecha completa, por ejemplo "Viernes 13 de noviembre". */
  title: string;
  /** Por ejemplo "Con Carlos · Sesión de 30 minutos". */
  detail?: string;
}

export interface BottomNavProps {
  /** Por defecto: Hoy, Semana, Clientes, Mi horario (ids today, week, clients, schedule). */
  items?: BottomNavItem[];
  /** id del elemento activo. */
  active: string;
  onSelect?: (id: string) => void;
}

export interface StepHeaderProps {
  /** Paso actual (1 a total). */
  step: number;
  /** Total de pasos; 4 por defecto. */
  total?: number;
  onBack?: () => void;
  /** Por defecto solo desde el paso 2; en el paso 1 se muestra la marca. */
  showBack?: boolean;
  brand?: string;
}

export interface SummaryCardItem {
  /** Nombre de un icono de Icon: users, calendar-check, clock… */
  icon: string;
  text: string;
}
export interface SummaryCardProps {
  items: SummaryCardItem[];
  label?: string;
}

export interface CheckboxFieldProps {
  label: string;
  /** Texto subrayado al final, p. ej. «Ver política». */
  linkText?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  error?: string;
  id?: string;
  onChange?: (event: unknown) => void;
}

export interface BackHeaderProps {
  /** Texto del botón; «Atrás» por defecto. */
  label?: string;
  onBack?: () => void;
}

export interface DayChipProps {
  /** Inicial del día: L, M, J… */
  day: string;
  /** Número del día del mes. */
  date: string | number;
  selected?: boolean;
  /** Etiqueta accesible completa, p. ej. «Jueves 12». */
  label?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  title: string;
  text?: string;
}

export interface SwitchProps {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  id?: string;
  onChange?: (event: unknown) => void;
}

export interface PasswordFieldProps {
  label: string;
  value?: string;
  defaultValue?: string;
  helper?: string;
  error?: string;
  id?: string;
  /** 'current-password' (por defecto) o 'new-password'. */
  autoComplete?: string;
  onChange?: (event: unknown) => void;
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
}
