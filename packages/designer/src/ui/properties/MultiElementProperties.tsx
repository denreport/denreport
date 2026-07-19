import type { IrElement, IrFlexChild } from "@denreport/core";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useMessages } from "../../i18n/context";
import { ELEMENT_TYPE_LABEL } from "../../state/element-labels";
import type { PlacedElementView } from "../../state/geometry";
import { updateElements } from "../../state/properties";
import type { EditorStore } from "../../state/store";
import type { BulkDescriptor } from "./bulk-descriptors";
import {
  applicableDescriptors,
  BULK_SECTION_ORDER,
  buildBulkDescriptors,
  bulkValueFor,
} from "./bulk-descriptors";
import { NumberField, SegmentField } from "./fields";

type AnyElement = IrElement | IrFlexChild;

function commitBulk(
  store: EditorStore,
  ids: readonly string[],
  descriptor: BulkDescriptor,
  value: number | string,
): void {
  const document = store.getState().document;
  const updated = updateElements(document, ids, (el) => {
    if (!descriptor.types.has(el.type)) {
      return el;
    }
    if (descriptor.kind === "number" && typeof value === "number") {
      return descriptor.apply(el, value);
    }
    if (descriptor.kind === "segment" && typeof value === "string") {
      return descriptor.apply(el, value);
    }
    return el;
  });
  if (updated !== document) {
    store.commit(updated);
  }
}

function Field(props: {
  readonly store: EditorStore;
  readonly ids: readonly string[];
  readonly descriptor: BulkDescriptor;
  readonly elements: readonly AnyElement[];
}): ReactNode {
  const { store, ids, descriptor, elements } = props;
  const bulk = bulkValueFor(descriptor, elements);
  if (descriptor.kind === "number") {
    return (
      <NumberField
        label={descriptor.label}
        value={bulk.kind === "uniform" ? (bulk.value as number) : null}
        unit={descriptor.unit}
        precision={descriptor.precision}
        onCommit={(value) => commitBulk(store, ids, descriptor, value)}
      />
    );
  }
  return (
    <SegmentField
      label={descriptor.label}
      value={bulk.kind === "uniform" ? (bulk.value as string) : null}
      options={descriptor.options}
      onCommit={(value) => commitBulk(store, ids, descriptor, value)}
    />
  );
}

export function MultiElementProperties(props: {
  readonly store: EditorStore;
  readonly views: readonly PlacedElementView[];
}): ReactNode {
  const { store, views } = props;
  const m = useMessages();
  const allDescriptors = useMemo(
    () => buildBulkDescriptors(m.propertiesBulk),
    [m],
  );
  const ids = views.map((view) => view.id);
  const elements = views.map((view) => view.element);
  const descriptors = applicableDescriptors(views, allDescriptors);
  const types = new Set(views.map((view) => view.element.type));
  const uniformType = types.size === 1 ? [...types][0] : undefined;

  return (
    <>
      <div className="apx-props-head">
        {uniformType !== undefined && (
          <span className="apx-type-badge">
            {ELEMENT_TYPE_LABEL[uniformType]}
          </span>
        )}
        <span className="apx-props-id">
          {m.propertiesBulk.selectedCount(views.length)}
        </span>
      </div>
      {BULK_SECTION_ORDER.map((section) => {
        const inSection = descriptors.filter((d) => d.section === section);
        if (inSection.length === 0) {
          return null;
        }
        return (
          <section className="apx-sect" key={section}>
            <div className="apx-sect-h">
              {m.propertiesBulk.sections[section]}
            </div>
            {inSection.map((descriptor) => (
              <Field
                key={descriptor.key}
                store={store}
                ids={ids}
                descriptor={descriptor}
                elements={elements}
              />
            ))}
          </section>
        );
      })}
    </>
  );
}
