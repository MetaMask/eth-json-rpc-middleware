declare global {
  // Using `namespace` here is okay because this is how the Jest types are
  // defined.
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-types
    interface Matchers<R, T = {}> {
      toNeverResolve(): Promise<R>;
    }
  }
}

// Export something so that TypeScript knows to interpret this as a module
export {};
