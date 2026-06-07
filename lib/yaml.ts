import YAML from "yaml";

export function toYaml(value: unknown) {
  return YAML.stringify(value, {
    lineWidth: 0,
    indent: 2
  });
}

export function fromYaml(text: string): unknown {
  return YAML.parse(text);
}
