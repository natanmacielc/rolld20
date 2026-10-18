package io.github.natanmacielc.rolld20.infra;

import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

/**
 * Stacks do ambiente dev (OIDC, Cert, Dev e Plan, nesta ordem). Deploy só pelo GitHub Actions (.github/workflows/deploy-dev.yml);
 * a DiceGithubOidcStack é aplicada uma vez, à mão, no bootstrap (infra/README.md).
 *
 * Os ids das stacks (DiceGithubOidcStack, DiceCertStack, DiceDevStack, DicePlanStack) são os nomes físicos no
 * CloudFormation: trocar um cria uma stack nova, com tabela e buckets vazios. Ficam os nomes do projeto antigo até a
 * fase de migração da AWS decidir o contrário; o código é que se chama RollD20.
 */
public final class RollD20App {

    private RollD20App() {
    }

    public static void main(String[] args) {
        App app = new App();
        build(app);
        app.synth();
    }

    record Stacks(RollD20GithubOidcStack oidc, RollD20CertStack cert, RollD20DevStack dev, RollD20PlanStack plan) {
    }

    static Stacks build(App app) {
        RollD20Config cfg = RollD20Config.from(app.getNode());
        RollD20GithubOidcStack oidc = new RollD20GithubOidcStack(app, "DiceGithubOidcStack",
                StackProps.builder().env(env(cfg, RollD20Config.REGION)).build(), cfg);
        if (cfg.hostedZoneId().isEmpty()) {
            // Sem a zona só dá para sintetizar a stack do OIDC (bootstrap).
            System.err.println("hostedZoneId ausente: só a DiceGithubOidcStack foi sintetizada");
            return new Stacks(oidc, null, null, null);
        }
        RollD20CertStack cert = new RollD20CertStack(app, "DiceCertStack",
                StackProps.builder().env(env(cfg, RollD20Config.CERT_REGION)).crossRegionReferences(true).build(), cfg);
        RollD20DevStack dev = new RollD20DevStack(app, "DiceDevStack",
                StackProps.builder().env(env(cfg, RollD20Config.REGION)).crossRegionReferences(true).build(), cfg,
                cert.certificate(), cert.webAclArn());
        // O plano precisa da distribuição pronta: sobe por último, em us-east-1 (onde fica o WAF).
        RollD20PlanStack plan = new RollD20PlanStack(app, "DicePlanStack",
                StackProps.builder().env(env(cfg, RollD20Config.CERT_REGION)).crossRegionReferences(true).build(),
                dev.distributionArn(), cert.webAclArn());
        return new Stacks(oidc, cert, dev, plan);
    }

    private static Environment env(RollD20Config cfg, String region) {
        return Environment.builder().account(cfg.account()).region(region).build();
    }
}
