export namespace DeploymentIdUtils {
    const idPattern: RegExp = /^[a-z0-9]+(?:[-][a-z0-9]+)*$/;

    export function isValidId(id: string): boolean {
        return idPattern.test(id);
    }

    export function suggestDeploymentId(fileName: string): string {
        let result = fileName;
        if (!DeploymentIdUtils.isValidId(fileName)) {
            result = enhanceDeploymentId(fileName);
        }
        return result;
    }

    function enhanceDeploymentId(suggestedDeploymentId: string): string {
        const invalidChars = /[^a-z0-9-]/g; // Inversion of all valid chars
        let result = suggestedDeploymentId.toLowerCase().replace(invalidChars, '-');
        const leadingDashes = /^-+/;
        const trailingDashes = /-+$/;
        const multipleDashes = /-+/g;
        result = result.replace(leadingDashes, '').replace(trailingDashes, '').replace(multipleDashes, '-');
        if (!idPattern.test(result)) {
            result = '';
        }
        return result;
    }
}
