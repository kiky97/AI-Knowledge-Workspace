import re

LINK_PATTERN = re.compile(r"\[\[([^\]]+)\]\]")


def extract_linked_titles(content: str) -> set[str]:
    return {match.strip() for match in LINK_PATTERN.findall(content)}
