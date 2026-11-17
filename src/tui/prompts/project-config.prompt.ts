import { confirm, input, password, select } from "@inquirer/prompts";

/** Opciones comunes de un prompt de texto. */
export interface PromptOptions {
  /** Valor que se usa si el usuario solo pulsa Enter. */
  default?: string;
  /** Devuelve `true` si el valor es válido o el motivo del rechazo (el prompt se vuelve a mostrar con ese motivo). */
  validate?: (value: string) => true | string;
}

/**
 * Prompts que usan los comandos de configuración. Es una interfaz para poder simularla en los tests:
 * los comandos no importan `@inquirer/prompts` directamente.
 */
export interface ConfigPrompts {
  /** Pide un texto; devuelve lo que escribió el usuario (o `default` si solo pulsó Enter). */
  input(message: string, options?: PromptOptions): Promise<string>;
  /** Pide un secreto con la entrada enmascarada; no se muestra en pantalla. */
  password(message: string, options?: Pick<PromptOptions, "validate">): Promise<string>;
}

/** Una opción de un menú de selección. */
export interface SelectChoice<T> {
  /** Texto que ve el usuario. */
  name: string;
  /** Valor que devuelve el prompt al elegirla. */
  value: T;
}

/** Prompts que usa `devflow config proyectos`: texto, selección y confirmación. */
export interface ProjectPrompts {
  /** Pide un texto; devuelve lo que escribió el usuario (o `default` si solo pulsó Enter). */
  input(message: string, options?: PromptOptions): Promise<string>;
  /** Muestra un menú y devuelve el `value` de la opción elegida. */
  select<T>(message: string, choices: SelectChoice<T>[]): Promise<T>;
  /** Pregunta sí o no; `defaultValue` es lo que vale Enter (por defecto `false`, la opción segura). */
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;
}

/**
 * Prompts reales sobre `@inquirer/prompts`. Adaptador fino sin lógica propia.
 *
 * @returns Las implementaciones interactivas de {@link ConfigPrompts} y {@link ProjectPrompts}.
 */
export function createInquirerPrompts(): ConfigPrompts & ProjectPrompts {
  return {
    select: (message, choices) => select({ message, choices }),
    confirm: (message, defaultValue = false) => confirm({ message, default: defaultValue }),
    input: (message, options) =>
      input({
        message,
        ...(options?.default !== undefined ? { default: options.default } : {}),
        ...(options?.validate ? { validate: options.validate } : {}),
      }),
    password: (message, options) =>
      password({ message, mask: "*", ...(options?.validate ? { validate: options.validate } : {}) }),
  };
}
