export function actorProfileSlug(name: string) {
    return name.normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
}

export function actorProfileHref(name: string) {
    const slug = actorProfileSlug(name)
    return slug ? '/ti/' + slug : '/ti/profiles'
}
