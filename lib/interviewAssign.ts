// 면접 시간 자동 배치 알고리즘 (순수 함수, prisma 의존 없음)
//
// 문제: 각 지원자는 희망 슬롯(preferences)을 여러 개 냈고, 각 슬롯은 잔여용량(capacity)이 있다.
// 용량을 지키면서 최대한 많은 지원자를 자신이 희망한 슬롯 중 하나에 배치한다.
//
// 방법: "용량 있는 이분 매칭 = 최대 유량" 문제를, 각 슬롯을 capacity 개의 좌석으로 확장한 뒤
//       표준 Kuhn(헝가리언 증가경로) 알고리즘으로 최대 이분 매칭을 구해 해결한다.
//       지원자 수/슬롯 수가 작으므로(수십~수백) 성능 문제는 없다.
//
// 결정론: applicants는 입력 순서를 그대로 유지하며 순서대로 매칭을 시도하고,
//         각 지원자의 preferences도 입력 순서대로 좌석을 시도한다.
//         존재하지 않는(또는 capacity 0인) 슬롯 id는 무시한다.
//         동일 입력이면 항상 동일 결과가 나온다.

export interface AssignApplicant {
  id: string;
  name: string;
  major: string;
  preferences: string[];
}

export interface AssignSlot {
  id: string;
  capacity: number;
}

export interface AssignmentResult {
  assignments: Record<string, string>; // applicantId -> slotId
  unassigned: string[]; // 배치 실패한 applicantId 배열
}

export function computeAssignment(
  applicants: AssignApplicant[],
  slots: AssignSlot[]
): AssignmentResult {
  // 슬롯을 좌석 단위로 확장. seatSlotId[seatIndex] = 해당 좌석이 속한 슬롯 id.
  // slotSeats: slotId -> 그 슬롯에 속한 좌석 인덱스 배열(preferences 순서대로 시도할 때 사용).
  const seatSlotId: string[] = [];
  const slotSeats = new Map<string, number[]>();

  for (const slot of slots) {
    const cap = Math.max(0, Math.floor(slot.capacity));
    const seats: number[] = [];
    for (let k = 0; k < cap; k++) {
      const seatIndex = seatSlotId.length;
      seatSlotId.push(slot.id);
      seats.push(seatIndex);
    }
    slotSeats.set(slot.id, seats);
  }

  // seatMatch[seatIndex] = 그 좌석에 매칭된 지원자 index(applicants 기준), 없으면 -1.
  const seatMatch: number[] = new Array(seatSlotId.length).fill(-1);
  const applicantSeat: number[] = new Array(applicants.length).fill(-1);

  // Kuhn 증가경로: 지원자 u의 희망 슬롯 좌석들을 순서대로 시도.
  const tryAssign = (u: number, visited: Set<number>): boolean => {
    for (const slotId of applicants[u].preferences) {
      const seats = slotSeats.get(slotId);
      if (!seats) continue; // 존재하지 않거나 용량 0인 슬롯 무시
      for (const seat of seats) {
        if (visited.has(seat)) continue;
        visited.add(seat);
        // 좌석이 비었거나, 기존 점유자를 다른 좌석으로 밀어낼 수 있으면 배치
        if (seatMatch[seat] === -1 || tryAssign(seatMatch[seat], visited)) {
          seatMatch[seat] = u;
          applicantSeat[u] = seat;
          return true;
        }
      }
    }
    return false;
  };

  for (let u = 0; u < applicants.length; u++) {
    tryAssign(u, new Set<number>());
  }

  const assignments: Record<string, string> = {};
  const unassigned: string[] = [];
  for (let u = 0; u < applicants.length; u++) {
    const seat = applicantSeat[u];
    if (seat === -1) {
      unassigned.push(applicants[u].id);
    } else {
      assignments[applicants[u].id] = seatSlotId[seat];
    }
  }

  return { assignments, unassigned };
}
