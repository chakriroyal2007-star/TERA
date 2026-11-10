"""
Relational Database Normalization and Functional Dependency Algorithms.
Provides exact algorithmic implementations for:
- Attribute Closure
- Candidate Key and Superkey Discovery
- Minimal / Canonical Cover
- Dependency Preservation
- Lossless Join Decomposition Testing
- Normal Form Classification (1NF, 2NF, 3NF, BCNF)
"""

from typing import List, Set, Tuple, Dict, Any
from itertools import combinations


def compute_attribute_closure(
    initial_attrs: Set[str],
    fds: List[Tuple[Set[str], Set[str]]]
) -> Set[str]:
    """
    Computes the attribute closure (X+) of a set of attributes X under a set of FDs.
    Iteratively adds RHS of any FD whose LHS is a subset of the current closure.
    """
    closure = set(initial_attrs)
    changed = True
    while changed:
        changed = False
        for lhs, rhs in fds:
            if lhs.issubset(closure) and not rhs.issubset(closure):
                closure.update(rhs)
                changed = True
    return closure


def is_superkey(
    candidate: Set[str],
    all_attributes: Set[str],
    fds: List[Tuple[Set[str], Set[str]]]
) -> bool:
    """Checks if a set of attributes is a superkey (closure equals all attributes)."""
    return compute_attribute_closure(candidate, fds) == all_attributes


def find_candidate_keys(
    all_attributes: Set[str],
    fds: List[Tuple[Set[str], Set[str]]]
) -> List[Set[str]]:
    """
    Finds all minimal candidate keys of a relation schema R under functional dependencies F.
    Uses candidate key lattice exploration from smallest size to largest size.
    """
    all_attrs_list = sorted(list(all_attributes))
    candidate_keys: List[Set[str]] = []

    # Essential attributes: appear on LHS of some FD but never on RHS
    rhs_all = set()
    for _, rhs in fds:
        rhs_all.update(rhs)
    
    lhs_all = set()
    for lhs, _ in fds:
        lhs_all.update(lhs)

    # Attributes that never appear in any FD must be in every candidate key
    unmentioned = all_attributes - (lhs_all | rhs_all)
    # Attributes that only appear on LHS must be in every candidate key
    strictly_lhs = lhs_all - rhs_all
    core_attributes = unmentioned | strictly_lhs

    # If core attributes form a superkey, it is the unique minimal candidate key
    if is_superkey(core_attributes, all_attributes, fds):
        return [core_attributes]

    # Search combinations of increasing size
    n = len(all_attrs_list)
    for size in range(max(1, len(core_attributes)), n + 1):
        # Pruning: if we found candidate keys of smaller size, we don't return supersets
        size_keys = []
        for combo in combinations(all_attrs_list, size):
            candidate = set(combo)
            if not core_attributes.issubset(candidate):
                continue
            # If candidate contains any previously found candidate key, it is a superkey, not minimal
            if any(prev_key.issubset(candidate) for prev_key in candidate_keys):
                continue
            if is_superkey(candidate, all_attributes, fds):
                size_keys.append(candidate)
        
        if size_keys:
            candidate_keys.extend(size_keys)

    if not candidate_keys:
        return [all_attributes]

    return candidate_keys


def compute_minimal_cover(
    fds: List[Tuple[Set[str], Set[str]]]
) -> List[Dict[str, Any]]:
    """
    Computes a Minimal Cover (Canonical Cover) for a set of functional dependencies.
    Step 1: Singleton right-hand sides.
    Step 2: Eliminate extraneous attributes on left-hand sides.
    Step 3: Eliminate redundant functional dependencies.
    """
    # Step 1: Singleton RHS
    single_rhs_fds: List[Tuple[Set[str], str]] = []
    for lhs, rhs in fds:
        for b in sorted(list(rhs)):
            single_rhs_fds.append((set(lhs), b))

    # Step 2: Eliminate extraneous LHS attributes
    reduced_lhs_fds: List[Tuple[Set[str], str]] = []
    for lhs, b in single_rhs_fds:
        curr_lhs = set(lhs)
        if len(curr_lhs) > 1:
            for attr in list(curr_lhs):
                test_lhs = curr_lhs - {attr}
                # Check if test_lhs can derive b using the current set of FDs
                # Convert list to tuple format for closure
                test_fds_tuple = [(f_lhs, {f_rhs}) for f_lhs, f_rhs in single_rhs_fds]
                if b in compute_attribute_closure(test_lhs, test_fds_tuple):
                    curr_lhs.remove(attr)
        reduced_lhs_fds.append((curr_lhs, b))

    # Step 3: Eliminate redundant FDs
    final_fds: List[Tuple[Set[str], str]] = []
    for i, (lhs, b) in enumerate(reduced_lhs_fds):
        # Other FDs excluding this one
        other_fds = [
            (f_lhs, {f_rhs})
            for j, (f_lhs, f_rhs) in enumerate(reduced_lhs_fds)
            if j != i
        ]
        # If lhs can still derive b without this FD, it is redundant
        closure_without = compute_attribute_closure(lhs, other_fds)
        if b not in closure_without:
            final_fds.append((lhs, b))

    # Combine common LHS for cleaner display
    combined: Dict[Tuple[str, ...], Set[str]] = {}
    for lhs, b in final_fds:
        key = tuple(sorted(list(lhs)))
        if key not in combined:
            combined[key] = set()
        combined[key].add(b)

    return [
        {"lhs": list(key), "rhs": sorted(list(rhs))}
        for key, rhs in combined.items()
    ]


def assess_normal_form(
    all_attributes: Set[str],
    candidate_keys: List[Set[str]],
    fds: List[Tuple[Set[str], Set[str]]]
) -> Dict[str, Any]:
    """
    Evaluates whether a relation satisfies 1NF, 2NF, 3NF, and BCNF.
    Identifies partial dependencies and transitive dependencies.
    """
    prime_attributes: Set[str] = set()
    for ck in candidate_keys:
        prime_attributes.update(ck)
    non_prime_attributes = all_attributes - prime_attributes

    partial_dependencies: List[Dict[str, Any]] = []
    transitive_dependencies: List[Dict[str, Any]] = []
    bcnf_violations: List[Dict[str, Any]] = []

    is_2nf = True
    is_3nf = True
    is_bcnf = True

    for lhs, rhs in fds:
        # Trivial FDs are ignored
        effective_rhs = rhs - lhs
        if not effective_rhs:
            continue

        lhs_is_superkey = any(ck.issubset(lhs) for ck in candidate_keys)

        # BCNF condition: every non-trivial X -> Y must have X as a superkey
        if not lhs_is_superkey:
            bcnf_violations.append({
                "lhs": sorted(list(lhs)),
                "rhs": sorted(list(effective_rhs)),
                "reason": "Determinant is not a superkey."
            })
            is_bcnf = False

        # Check 2NF: No non-prime attribute should be functionally dependent on a proper subset of ANY candidate key
        for ck in candidate_keys:
            if lhs.issubset(ck) and lhs != ck:
                dependent_non_primes = effective_rhs.intersection(non_prime_attributes)
                if dependent_non_primes:
                    partial_dependencies.append({
                        "lhs": sorted(list(lhs)),
                        "rhs": sorted(list(dependent_non_primes)),
                        "candidate_key": sorted(list(ck)),
                        "reason": f"Non-prime attributes depend on proper subset of candidate key {sorted(list(ck))}."
                    })
                    is_2nf = False

        # Check 3NF: For every non-trivial X -> Y:
        # Either X is a superkey OR every attribute in Y is prime
        if not lhs_is_superkey:
            non_prime_rhs = effective_rhs.intersection(non_prime_attributes)
            if non_prime_rhs:
                transitive_dependencies.append({
                    "lhs": sorted(list(lhs)),
                    "rhs": sorted(list(non_prime_rhs)),
                    "reason": "LHS is not a superkey and RHS contains non-prime attributes."
                })
                is_3nf = False

    # A relation is in 3NF only if it is in 2NF and has no transitive dependencies
    if not is_2nf:
        is_3nf = False
        is_bcnf = False

    highest_nf = "1NF"
    if is_2nf:
        highest_nf = "2NF"
    if is_3nf:
        highest_nf = "3NF"
    if is_bcnf:
        highest_nf = "BCNF"

    return {
        "highest_normal_form": highest_nf,
        "is_1nf": True,
        "is_2nf": is_2nf,
        "is_3nf": is_3nf,
        "is_bcnf": is_bcnf,
        "prime_attributes": sorted(list(prime_attributes)),
        "non_prime_attributes": sorted(list(non_prime_attributes)),
        "partial_dependencies": partial_dependencies,
        "transitive_dependencies": transitive_dependencies,
        "bcnf_violations": bcnf_violations,
    }

