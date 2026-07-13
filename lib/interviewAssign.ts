// 면접 시간 자동 배치 알고리즘 (순수 함수, prisma 의존 없음)
//
// 문제: 각 지원자는 희망 슬롯(preferences)을 여러 개 냈고, 각 슬롯은 잔여용량(capacity)이 있다.
// 용량을 지키면서 최대한 많은 지원자를 자신이 희망한 슬롯 중 하나에 배치하되,
// 같은 슬롯에는 가급적 1·2학년끼리 / 3·4학년끼리 묶고, 같은 학년그룹 안에서는
// 같은 전공끼리 묶는다. 우선순위: 가능시간·용량·최대인원(절대) > 학년그룹 > 전공.
//
// 방법:
//   1단계(시드 배치): "용량 있는 이분 매칭 = 최대 유량" 문제를, 각 슬롯을 capacity 개의
//     좌석으로 확장한 뒤 표준 Kuhn(헝가리언 증가경로) 알고리즘으로 최대 이분 매칭을 구한다.
//     이때 지원자를 (학년그룹, 전공, 입력순)으로 정렬한 사본으로 매칭을 실행해
//     비슷한 지원자가 연속으로 배치를 시도하며 자연스럽게 뭉치게 한다.
//     Kuhn의 최대 매칭 크기는 시도 순서와 무관하므로 배치 인원은 줄지 않는다.
//   2단계(스왑 개선): 배치된 두 지원자가 서로의 슬롯을 모두 희망했다면 자리를 교환해도
//     가능시간·용량이 그대로 지켜진다. 교환으로 "클러스터 점수"(슬롯 내 지원자 쌍마다
//     같은 학년그룹 +10, 같은 학년그룹이면서 같은 전공이면 +1 추가)가 증가하면 스왑한다.
//     또한 미배치 지원자가 어떤 배치자의 슬롯을 희망하고 그와 교체 시 점수가 증가하면
//     교체한다(배치 인원 수는 동일하게 유지됨). 마지막으로 배치자가 희망하는 다른 슬롯에
//     빈자리가 있고 그리로 이동 시 점수가 증가하면 이동한다(relocation).
//     개선이 없을 때까지 반복하되 최대 20회 전체 순회로 제한한다.
//
// 결정론: 정렬 기준과 쌍 순회 순서(인덱스 순)가 고정이므로 동일 입력이면 항상 동일 결과.
//         존재하지 않는(또는 capacity 0인) 슬롯 id는 무시한다.

export interface AssignApplicant {
  id: string;
  name: string;
  major: string;
  grade: string;
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

export type GradeGroup = "JUNIOR" | "SENIOR" | "UNKNOWN";

// 학년그룹 파싱: "1학년"/"2학년"... 형태를 기대. 자유입력 레거시는 UNKNOWN.
// UNKNOWN은 클러스터 점수에서 어느 그룹과도(다른 UNKNOWN과도) 동질로 치지 않는다.
export function parseGradeGroup(grade: string): GradeGroup {
  if (/^[12]학년/.test(grade)) return "JUNIOR";
  if (/^[34]학년/.test(grade)) return "SENIOR";
  return "UNKNOWN";
}

// 슬롯 내 지원자 쌍의 클러스터 점수: 같은 학년그룹 +10, 그 안에서 같은 전공이면 +1 추가.
function pairScore(a: AssignApplicant, b: AssignApplicant): number {
  const ga = parseGradeGroup(a.grade);
  if (ga === "UNKNOWN" || ga !== parseGradeGroup(b.grade)) return 0;
  return a.major === b.major ? 11 : 10;
}

// 표준 Kuhn 최대 이분 매칭. applicants 순서대로 매칭을 시도한다(결정론).
function kuhnMatch(
  applicants: AssignApplicant[],
  slots: AssignSlot[]
): Record<string, string> {
  // 슬롯을 좌석 단위로 확장. seatSlotId[seatIndex] = 해당 좌석이 속한 슬롯 id.
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
  for (let u = 0; u < applicants.length; u++) {
    const seat = applicantSeat[u];
    if (seat !== -1) assignments[applicants[u].id] = seatSlotId[seat];
  }
  return assignments;
}

export function computeAssignment(
  applicants: AssignApplicant[],
  slots: AssignSlot[]
): AssignmentResult {
  // 1단계: (학년그룹, 전공, 입력순) 정렬 사본으로 Kuhn 시드 배치
  const groupOrder: Record<GradeGroup, number> = { JUNIOR: 0, SENIOR: 1, UNKNOWN: 2 };
  const sorted = applicants
    .map((a, idx) => ({ a, idx }))
    .sort((x, y) => {
      const gx = groupOrder[parseGradeGroup(x.a.grade)];
      const gy = groupOrder[parseGradeGroup(y.a.grade)];
      if (gx !== gy) return gx - gy;
      if (x.a.major !== y.a.major) return x.a.major < y.a.major ? -1 : 1;
      return x.idx - y.idx;
    })
    .map((e) => e.a);

  const assignments = kuhnMatch(sorted, slots);

  // 2단계: 상호 희망 슬롯 교환 + 미배치자와의 교체 + 빈자리 이동으로 클러스터 점수 개선
  const prefSets = new Map<string, Set<string>>();
  for (const a of applicants) prefSets.set(a.id, new Set(a.preferences));

  const slotCapacity = new Map<string, number>();
  for (const slot of slots) slotCapacity.set(slot.id, Math.max(0, Math.floor(slot.capacity)));

  const slotMembers = new Map<string, AssignApplicant[]>();
  for (const a of applicants) {
    const slotId = assignments[a.id];
    if (slotId === undefined) continue;
    if (!slotMembers.has(slotId)) slotMembers.set(slotId, []);
    slotMembers.get(slotId)!.push(a);
  }

  // app이 slotId에 들어갈 때 얻는 점수 (excludeId 멤버 제외)
  const scoreIn = (app: AssignApplicant, slotId: string, excludeId: string): number => {
    let s = 0;
    for (const m of slotMembers.get(slotId) ?? []) {
      if (m.id === excludeId || m.id === app.id) continue;
      s += pairScore(app, m);
    }
    return s;
  };

  const MAX_PASSES = 20;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;
    const assigned = applicants.filter((a) => assignments[a.id] !== undefined);
    const unassignedNow = applicants.filter((a) => assignments[a.id] === undefined);

    // (a) 배치자끼리 스왑: 서로의 슬롯을 모두 희망해야 교환 가능
    for (let i = 0; i < assigned.length; i++) {
      for (let j = i + 1; j < assigned.length; j++) {
        const a = assigned[i];
        const b = assigned[j];
        const slotA = assignments[a.id];
        const slotB = assignments[b.id];
        if (slotA === slotB) continue;
        if (!prefSets.get(a.id)!.has(slotB) || !prefSets.get(b.id)!.has(slotA)) continue;

        const before = scoreIn(a, slotA, a.id) + scoreIn(b, slotB, b.id);
        const after = scoreIn(a, slotB, b.id) + scoreIn(b, slotA, a.id);
        if (after > before) {
          assignments[a.id] = slotB;
          assignments[b.id] = slotA;
          slotMembers.set(slotA, [
            ...slotMembers.get(slotA)!.filter((m) => m.id !== a.id),
            b,
          ]);
          slotMembers.set(slotB, [
            ...slotMembers.get(slotB)!.filter((m) => m.id !== b.id),
            a,
          ]);
          improved = true;
        }
      }
    }

    // (b) 배치자 ↔ 미배치자 교체: 배치 인원 수는 그대로, 슬롯 구성만 개선
    for (const a of assigned) {
      if (assignments[a.id] === undefined) continue; // 이번 패스에서 이미 교체됨
      const slotA = assignments[a.id];
      for (const u of unassignedNow) {
        if (assignments[u.id] !== undefined) continue; // 이번 패스에서 이미 배치됨
        if (!prefSets.get(u.id)!.has(slotA)) continue;
        if (scoreIn(u, slotA, a.id) > scoreIn(a, slotA, a.id)) {
          assignments[u.id] = slotA;
          delete assignments[a.id];
          slotMembers.set(slotA, [
            ...slotMembers.get(slotA)!.filter((m) => m.id !== a.id),
            u,
          ]);
          improved = true;
          break;
        }
      }
    }

    // (c) 배치자 이동(relocation): 빈자리가 있는 다른 희망 슬롯으로 옮겨 점수가 오르면 이동.
    //     배치 인원 수·용량 제약은 그대로 유지된다.
    for (const a of assigned) {
      if (assignments[a.id] === undefined) continue; // 이번 패스에서 (b)로 미배치됨
      const slotA = assignments[a.id];
      const current = scoreIn(a, slotA, a.id);
      let bestSlot: string | null = null;
      let bestGain = 0;
      for (const slotB of prefSets.get(a.id)!) {
        if (slotB === slotA) continue;
        const cap = slotCapacity.get(slotB);
        if (cap === undefined) continue; // 존재하지 않는 슬롯 무시
        if ((slotMembers.get(slotB)?.length ?? 0) >= cap) continue; // 빈자리 없음
        const gain = scoreIn(a, slotB, a.id) - current;
        if (gain > bestGain) {
          bestGain = gain;
          bestSlot = slotB;
        }
      }
      if (bestSlot !== null) {
        assignments[a.id] = bestSlot;
        slotMembers.set(slotA, slotMembers.get(slotA)!.filter((m) => m.id !== a.id));
        slotMembers.set(bestSlot, [...(slotMembers.get(bestSlot) ?? []), a]);
        improved = true;
      }
    }

    if (!improved) break;
  }

  const unassigned = applicants.filter((a) => assignments[a.id] === undefined).map((a) => a.id);

  return { assignments, unassigned };
}
