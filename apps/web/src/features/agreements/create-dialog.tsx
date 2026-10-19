import { Label } from '../../design-system/controls';
import { documentQueries } from '../documents/hooks';
import { useCreateAgreementMutation } from './hooks';
import {
  Accordion,
  AccordionTrigger,
  FormActions,
} from '../../design-system/layout';
import {
  Checkbox,
  FormField,
  Input,
  Textarea,
} from '../../design-system/controls';

import { Select } from '../../design-system/select';
import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  agreementCreateSchema,
  agreementApplicabilitySchema,
  analysisLineSchema,
  agreementReferenceSchema,
} from '@reconcile/contracts';
import { z } from 'zod';
import type { AgreementVersion } from '@reconcile/contracts';
import { Dialog } from '../../design-system/dialog';
import {
  Button,
  Feedback,
  Field,
  RequestError,
} from '../../design-system/primitives';
import { Loading } from '../../design-system/loading';
import { documentPath } from '../documents/api';
import { UploadDialog } from '../documents/upload-dialog';
import { errorMessage } from '../../lib/forms';
import { useMounted } from '../../lib/use-mounted';

type BandDraft = {
  fromKm: string;
  toKm: string;
  basis: 'fixed-trip' | 'per-km';
  amount: string;
};
export function CreateAgreementDialog({
  userId,
  organizationId,
  operationId,
  disabled,
  label = 'Crear acuerdo',
  onCreated,
}: {
  userId: string;
  organizationId: string;
  operationId?: string;
  disabled: boolean;
  label?: string;
  onCreated?: (agreement: AgreementVersion) => void;
}) {
  const createAgreementMutation = useCreateAgreementMutation(userId);

  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pricingType, setPricingType] = useState('fixed-trip');
  const [bands, setBands] = useState<BandDraft[]>([
    { fromKm: '0', toKm: '30', basis: 'fixed-trip', amount: '' },
  ]);
  const [evidencePage, setEvidencePage] = useState('');
  const [snippet, setSnippet] = useState('');
  const [structuredTerms, setStructuredTerms] = useState('');
  const mounted = useMounted();
  const id = useId();
  const sources = useQuery({
    ...documentQueries.list(userId, organizationId, page),
    enabled: open && !disabled,
  });
  const source = useQuery({
    ...documentQueries.detail(userId, organizationId, sourceId),
    enabled: open && !disabled && Boolean(sourceId),
    refetchInterval: (query) =>
      query.state.data?.status === 'queued' ||
      query.state.data?.status === 'processing'
        ? 2000
        : false,
  });
  const selectedPage = source.data?.latestRun?.result?.pages.find(
    (item) => String(item.page) === evidencePage,
  );
  const eligible =
    source.data &&
    (source.data.kind === 'tariff' || source.data.kind === 'quotation') &&
    source.data.latestRun?.result;
  return (
    <Dialog
      title={operationId ? 'Crear tarifa spot' : 'Crear acuerdo reutilizable'}
      description="Esta versión cubre un servicio y un ámbito. Revisá las condiciones contra el PDF original; otros conceptos quedan pendientes. Los valores se guardan de forma inmutable."
      trigger={
        <Button variant="outline" disabled={disabled}>
          {label}
        </Button>
      }
      open={open && !disabled}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        setError('');
      }}
    >
      <Feedback error message={error} />
      <form
        className="agreement-form"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (
            busy ||
            disabled ||
            !eligible ||
            !source.data?.latestRun ||
            !selectedPage
          )
            return;
          const form = new FormData(event.currentTarget);
          const value = (key: string) => String(form.get(key) ?? '').trim();
          const normalizedSnippet = snippet.trim();
          if (
            !normalizedSnippet ||
            !selectedPage.text.includes(normalizedSnippet)
          ) {
            setError(
              'La cita debe copiarse literalmente de la página seleccionada (máximo 500 caracteres).',
            );
            return;
          }
          const evidence = [
            {
              documentId: sourceId,
              extractionRunId: source.data.latestRun.id,
              page: selectedPage.page,
              snippet: normalizedSnippet,
            },
          ];
          let advanced: unknown = {};
          if (structuredTerms.trim()) {
            try {
              advanced = JSON.parse(structuredTerms);
            } catch {
              setError('Las condiciones estructuradas deben ser JSON válido.');
              return;
            }
          }
          const advancedResult = z
            .object({
              agreementIdentity: z
                .string()
                .trim()
                .min(1)
                .max(500)
                .nullable()
                .optional(),
              references: z.array(agreementReferenceSchema).max(100).optional(),
              applicability: agreementApplicabilitySchema.optional(),
              lines: z.array(analysisLineSchema).max(100).optional(),
            })
            .strict()
            .safeParse(advanced);
          if (!advancedResult.success) {
            setError(
              'Revisá identidad, aplicabilidad, partidas y evidencia de las condiciones estructuradas.',
            );
            return;
          }
          const parsed = agreementCreateSchema.safeParse({
            name: value('name'),
            scope: operationId ? 'spot' : 'reusable',
            operationId: operationId ?? null,
            sourceDocumentId: sourceId,
            terms: {
              ...advancedResult.data,
              agreementBasis: 'accepted',
              provider: value('provider'),
              currency: value('currency') || null,
              validFrom: value('validFrom'),
              validUntil: value('validUntil'),
              route: value('route'),
              service: value('service'),
              pricing:
                pricingType === 'line-items'
                  ? { type: 'line-items' }
                  : pricingType === 'distance-bands'
                    ? {
                        type: pricingType,
                        bands: bands.map((band) => ({ ...band, evidence })),
                      }
                    : { type: pricingType, amount: value('amount'), evidence },
              evidence,
            },
            reason: value('reason'),
          });
          if (!parsed.success) {
            setError(
              'Revisá los campos: fechas válidas, moneda de tres letras, precios positivos con punto decimal y tramos ordenados sin solapamientos.',
            );
            return;
          }
          setBusy(true);
          setError('');
          void (async () => {
            try {
              const agreement = await createAgreementMutation.mutateAsync([
                organizationId,
                parsed.data,
              ]);
              if (mounted.current) {
                setOpen(false);
                onCreated?.(agreement);
              }
            } catch (error) {
              if (mounted.current) setError(errorMessage(error));
            } finally {
              if (mounted.current) setBusy(false);
            }
          })();
        }}
      >
        <FormField className="field">
          <Label htmlFor={`${id}-structured-terms`}>
            Identidad, aplicabilidad y partidas estructuradas (opcional)
          </Label>
          <p className="metadata">
            JSON con agreementIdentity, references, applicability y lines.
            Permite documentar condiciones, columnas por equipo, bases por
            contenedor/BL/envío, monedas e inclusiones sin sumar columnas. Cada
            evidencia debe citar el PDF seleccionado. Si falta un dato,
            mantenelo desconocido.
          </p>
          <Textarea
            id={`${id}-structured-terms`}
            rows={10}
            value={structuredTerms}
            disabled={busy}
            onChange={(event) => setStructuredTerms(event.target.value)}
          />
        </FormField>
        <fieldset disabled={busy || disabled}>
          <legend>1. PDF de origen</legend>
          <UploadDialog
            userId={userId}
            organizationId={organizationId}
            disabled={busy || disabled}
            defaultKind={operationId ? 'quotation' : 'tariff'}
            onUploaded={(documentId) => {
              setSourceId(documentId);
              setEvidencePage('');
              setSnippet('');
            }}
          />
          {sources.isPending ? (
            <Loading label="Cargando PDF disponibles…" />
          ) : sources.isError ? (
            <RequestError
              error={sources.error}
              retry={() => {
                void sources.refetch();
              }}
            />
          ) : (
            <>
              <FormField className="field">
                <Label htmlFor={`${id}-source`}>Usar un PDF ya cargado</Label>
                <Select
                  id={`${id}-source`}
                  required
                  value={sourceId}
                  onValueChange={(selectedValue) => {
                    setSourceId(selectedValue);
                    setEvidencePage('');
                    setSnippet('');
                  }}
                >
                  <option value="">Seleccioná Tarifa o Cotización</option>
                  {sourceId &&
                    !sources.data.items.some(
                      (item) => item.id === sourceId,
                    ) && (
                      <option value={sourceId}>
                        {source.data?.filename ?? 'PDF seleccionado'}
                      </option>
                    )}
                  {sources.data.items
                    .filter(
                      (item) =>
                        item.kind === 'tariff' || item.kind === 'quotation',
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.filename}
                      </option>
                    ))}
                </Select>
              </FormField>
              <div className="pagination">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!page || sources.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <span>Página {page + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={
                    (page + 1) * 25 >= sources.data.total || sources.isFetching
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </>
          )}
          {source.isFetching && (
            <Loading inline label="Consultando extracción…" />
          )}
          {source.isError && (
            <RequestError
              error={source.error}
              retry={() => {
                void source.refetch();
              }}
            />
          )}
          {source.data && (
            <p>
              <a
                href={documentPath(organizationId, sourceId)}
                target="_blank"
                rel="noreferrer"
              >
                Abrir original y extracción de {source.data.filename} (otra
                pestaña)
              </a>
            </p>
          )}
          {source.data && !eligible && (
            <p className="document-warning">
              Esperá a que termine la extracción. El original debe estar
              clasificado como Tarifa o Cotización y tener texto disponible.
            </p>
          )}
        </fieldset>
        <fieldset disabled={busy || disabled || !eligible} key={sourceId}>
          <legend>2. Condiciones revisadas</legend>
          <Field name="name" label="Nombre del acuerdo" maxLength={200} />
          <Field
            name="provider"
            label="Proveedor"
            maxLength={500}
            defaultValue={
              source.data?.latestRun?.result?.fields.find(
                (field) => field.name === 'provider',
              )?.value ?? ''
            }
          />
          <Field name="validFrom" label="Vigente desde" type="date" />
          <Field
            name="validUntil"
            label="Vigente hasta (incluido)"
            type="date"
          />
          <Field
            name="route"
            label="Ruta o ámbito del servicio"
            maxLength={500}
            hint="Se comparará con el ámbito revisado de la operación."
          />
          <FormField className="field">
            <Label htmlFor={`${id}-service`}>Servicio</Label>
            <Select id={`${id}-service`} name="service">
              <option value="pickup">Recogida / transporte terrestre</option>
              <option value="ocean-handling">Servicio base marítimo</option>
            </Select>
          </FormField>
          <Field
            name="currency"
            required={pricingType !== 'line-items'}
            label="Moneda ISO (EUR, USD…)"
            pattern="[A-Z]{3}"
            maxLength={3}
          />
          <FormField className="field">
            <Label htmlFor={`${id}-pricing`}>Cómo se calcula el precio</Label>
            <Select
              id={`${id}-pricing`}
              value={pricingType}
              onValueChange={(selectedValue) => setPricingType(selectedValue)}
            >
              <option value="line-items">
                Partidas por unidad, equipo y moneda
              </option>
              <option value="fixed-trip">Precio total por viaje</option>
              <option value="per-km">Precio por kilómetro</option>
              <option value="distance-bands">Tramos de distancia</option>
            </Select>
          </FormField>
          {pricingType !== 'distance-bands' && pricingType !== 'line-items' ? (
            <Field
              name="amount"
              label={
                pricingType === 'per-km'
                  ? 'Precio por kilómetro'
                  : 'Precio total por viaje'
              }
              inputMode="decimal"
              hint="Usá punto decimal. Sin conversión de moneda ni impuestos implícitos."
            />
          ) : pricingType === 'distance-bands' ? (
            <>
              <p className="metadata">
                Cada tramo incluye el límite inferior y excluye el superior: [0,
                30) incluye 0 y no incluye 30. A los 30 km se aplica el
                siguiente tramo. Los huecos quedan sin tarifa.
              </p>
              {bands.map((band, index) => (
                <fieldset key={index}>
                  <legend>Tramo {index + 1}</legend>
                  {(['fromKm', 'toKm', 'amount'] as const).map((key) => (
                    <FormField className="field" key={key}>
                      <Label htmlFor={`${id}-${key}-${index}`}>
                        {key === 'fromKm'
                          ? 'Desde km (incluido)'
                          : key === 'toKm'
                            ? 'Hasta km (excluido)'
                            : 'Precio'}
                      </Label>
                      <Input
                        id={`${id}-${key}-${index}`}
                        required
                        inputMode="decimal"
                        value={band[key]}
                        onChange={(event) =>
                          setBands(
                            bands.map((item, position) =>
                              position === index
                                ? { ...item, [key]: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </FormField>
                  ))}
                  <FormField className="field">
                    <Label htmlFor={`${id}-basis-${index}`}>
                      Base del precio del tramo
                    </Label>
                    <Select
                      id={`${id}-basis-${index}`}
                      value={band.basis}
                      onValueChange={(selectedValue) =>
                        setBands(
                          bands.map((item, position) =>
                            position === index
                              ? {
                                  ...item,
                                  basis:
                                    selectedValue === 'per-km'
                                      ? 'per-km'
                                      : 'fixed-trip',
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="fixed-trip">Total por viaje</option>
                      <option value="per-km">Por kilómetro</option>
                    </Select>
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={bands.length === 1}
                    onClick={() =>
                      setBands(
                        bands.filter((_, position) => position !== index),
                      )
                    }
                  >
                    Quitar tramo {index + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={bands.length >= 50}
                onClick={() =>
                  setBands([
                    ...bands,
                    {
                      fromKm: bands.at(-1)?.toKm ?? '0',
                      toKm: '',
                      amount: '',
                      basis: 'fixed-trip',
                    },
                  ])
                }
              >
                Agregar tramo
              </Button>
            </>
          ) : (
            <p>
              Informá las partidas documentadas en las condiciones
              estructuradas. No hace falta un precio global ni una moneda común.
            </p>
          )}
        </fieldset>
        <fieldset disabled={busy || disabled || !eligible}>
          <legend>3. Evidencia y confirmación</legend>
          <p className="metadata">
            La cita debe respaldar las condiciones y precios ingresados. Revisá
            el PDF completo; el sistema no deduce una tabla arbitraria
            automáticamente.
          </p>
          <FormField className="field">
            <Label htmlFor={`${id}-page`}>Página de evidencia</Label>
            <Select
              id={`${id}-page`}
              required
              value={evidencePage}
              onValueChange={(selectedValue) => {
                setEvidencePage(selectedValue);
                setSnippet('');
              }}
            >
              <option value="">Elegí la página</option>
              {source.data?.latestRun?.result?.pages.map((page) => (
                <option key={page.page} value={page.page}>
                  Página {page.page}
                </option>
              ))}
            </Select>
          </FormField>
          {selectedPage && (
            <Accordion>
              <AccordionTrigger>
                Texto original de página {selectedPage.page}
              </AccordionTrigger>
              <pre className="agreement-source-text">{selectedPage.text}</pre>
            </Accordion>
          )}
          <FormField className="field">
            <Label htmlFor={`${id}-snippet`}>
              Cita literal que respalda estas condiciones
            </Label>
            <Textarea
              id={`${id}-snippet`}
              required
              maxLength={500}
              value={snippet}
              onChange={(event) => setSnippet(event.target.value)}
            />
          </FormField>
          <Field
            name="reason"
            label="Motivo de publicación / revisión"
            maxLength={500}
          />
          <Label className="document-choice">
            <Checkbox required />
            <span>
              Revisé las condiciones y precios contra el original y confirmé que
              están aceptados por las partes.
            </span>
          </Label>
        </fieldset>
        <FormActions className="dialog-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            pending={busy}
            disabled={disabled || !eligible || !selectedPage}
          >
            Publicar versión revisada
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}
