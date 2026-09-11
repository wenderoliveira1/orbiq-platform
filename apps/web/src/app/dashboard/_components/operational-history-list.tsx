import Link from "next/link";

import {
  compactVisitServices,
  formatVisitDate,
  formatVisitKm,
  type HistoryVisit,
} from "../_lib/operational-history";

type Props = {
  visits: HistoryVisit[];
  emptyTitle: string;
  emptyHint: string;
  testId: string;
  showVehiclePlate?: Record<string, string>;
};

export function OperationalHistoryList({
  visits,
  emptyTitle,
  emptyHint,
  testId,
  showVehiclePlate,
}: Props) {
  if (visits.length === 0) {
    return (
      <div className="orbiq-empty compact" data-testid={`${testId}-empty`}>
        <strong>{emptyTitle}</strong>
        <span>{emptyHint}</span>
      </div>
    );
  }

  return (
    <div className="ops-history-list" data-testid={testId}>
      {visits.map((visit) => {
        const plate = showVehiclePlate?.[visit.vehicleId];
        return (
          <article key={visit.id} className="ops-history-row" data-testid="ops-history-row">
            <div className="ops-history-when">
              <strong>{formatVisitDate(visit.createdAt)}</strong>
              <span>{formatVisitKm(visit.mileage)}</span>
            </div>
            <div className="ops-history-main">
              <div className="ops-history-meta">
                <span className={`quote-status status-${visit.status}`}>{visit.statusLabel}</span>
                <span className="ops-history-protocol">{visit.protocol}</span>
                {plate ? <span className="orbiq-plate compact">{plate}</span> : null}
              </div>
              <p>{compactVisitServices(visit.services)}</p>
            </div>
            <Link
              href={`/dashboard/orcamentos/${visit.id}`}
              className="orbiq-secondary-button"
            >
              Abrir
            </Link>
          </article>
        );
      })}
    </div>
  );
}
