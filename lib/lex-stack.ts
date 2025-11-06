import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lex from "aws-cdk-lib/aws-lex";
import * as iam from "aws-cdk-lib/aws-iam";

export interface LexStackProps extends cdk.StackProps {}

export class LexStack extends cdk.Stack {
  public readonly bot: lex.CfnBot;
  public readonly botAlias: lex.CfnBotAlias;
  public readonly botId: string;
  public readonly botAliasId: string;

  constructor(scope: Construct, id: string, props: LexStackProps) {
    super(scope, id, props);

    // Lex 봇 서비스 역할 생성
    const botRole = new iam.Role(this, "LexBotRole", {
      assumedBy: new iam.ServicePrincipal("lexv2.amazonaws.com"),
      description: "Service role for Lex V2 bot",
    });

    botRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["polly:SynthesizeSpeech"],
        resources: ["*"],
      })
    );

    // Lex 봇 생성
    this.bot = new lex.CfnBot(this, "PartnerConfirmationBot", {
      name: "PartnerConfirmationBot",
      description: "파트너 확인 자동화 봇",
      roleArn: botRole.roleArn,
      dataPrivacy: {
        childDirected: false,
      },
      idleSessionTtlInSeconds: 300,
      botLocales: [
        {
          localeId: "ko_KR",
          description: "한국어 로케일",
          nluConfidenceThreshold: 0.4,
          voiceSettings: {
            voiceId: "Seoyeon",
          },
          slotTypes: [
            {
              name: "ReservationNumber",
              description: "예약번호 슬롯 타입",
              slotTypeValues: [
                {
                  sampleValue: { value: "RES001" },
                },
                {
                  sampleValue: { value: "RES002" },
                },
                {
                  sampleValue: { value: "RES003" },
                },
              ],
              valueSelectionSetting: {
                resolutionStrategy: "TopResolution",
              },
            },
          ],
          intents: [
            // 예약변경 인텐트
            {
              name: "ReservationChange",
              description: "예약 변경 요청 인텐트",
              sampleUtterances: [
                { utterance: "예약을 변경하고 싶어요" },
                { utterance: "예약 시간을 바꾸고 싶습니다" },
                { utterance: "예약 날짜를 변경할 수 있나요" },
                { utterance: "다른 시간으로 예약 변경 가능한가요" },
                { utterance: "예약을 다시 잡고 싶어요" },
              ],
              slotPriorities: [
                {
                  priority: 1,
                  slotName: "ReservationNumber",
                },
              ],
              slots: [
                {
                  name: "ReservationNumber",
                  description: "예약번호",
                  slotTypeName: "ReservationNumber",
                  valueElicitationSetting: {
                    slotConstraint: "Required",
                    promptSpecification: {
                      messageGroupsList: [
                        {
                          message: {
                            plainTextMessage: {
                              value: "예약번호를 알려주세요.",
                            },
                          },
                        },
                      ],
                      maxRetries: 2,
                    },
                  },
                },
              ],
              intentClosingSetting: {
                closingResponse: {
                  messageGroupsList: [
                    {
                      message: {
                        plainTextMessage: {
                          value:
                            "예약 변경 요청을 접수했습니다. 잠시만 기다려주세요.",
                        },
                      },
                    },
                  ],
                },
              },
            },
            // 트러블신고 인텐트
            {
              name: "TroubleReport",
              description: "트러블 신고 인텐트",
              sampleUtterances: [
                { utterance: "문제가 있어요" },
                { utterance: "트러블이 발생했습니다" },
                { utterance: "서비스에 문제가 있어요" },
                { utterance: "불편사항을 신고하고 싶어요" },
                { utterance: "고장이 났어요" },
              ],
              slotPriorities: [
                {
                  priority: 1,
                  slotName: "ReservationNumber",
                },
              ],
              slots: [
                {
                  name: "ReservationNumber",
                  description: "예약번호",
                  slotTypeName: "ReservationNumber",
                  valueElicitationSetting: {
                    slotConstraint: "Required",
                    promptSpecification: {
                      messageGroupsList: [
                        {
                          message: {
                            plainTextMessage: {
                              value: "예약번호를 알려주세요.",
                            },
                          },
                        },
                      ],
                      maxRetries: 2,
                    },
                  },
                },
              ],
              intentClosingSetting: {
                closingResponse: {
                  messageGroupsList: [
                    {
                      message: {
                        plainTextMessage: {
                          value:
                            "트러블 신고를 접수했습니다. 빠르게 확인하겠습니다.",
                        },
                      },
                    },
                  ],
                },
              },
            },
            // 부가서비스 인텐트
            {
              name: "AdditionalService",
              description: "부가 서비스 요청 인텐트",
              sampleUtterances: [
                { utterance: "추가 서비스를 신청하고 싶어요" },
                { utterance: "부가 서비스가 필요해요" },
                { utterance: "옵션을 추가하고 싶습니다" },
                { utterance: "서비스를 더 받을 수 있나요" },
                { utterance: "추가 요청사항이 있어요" },
              ],
              slotPriorities: [
                {
                  priority: 1,
                  slotName: "ReservationNumber",
                },
              ],
              slots: [
                {
                  name: "ReservationNumber",
                  description: "예약번호",
                  slotTypeName: "ReservationNumber",
                  valueElicitationSetting: {
                    slotConstraint: "Required",
                    promptSpecification: {
                      messageGroupsList: [
                        {
                          message: {
                            plainTextMessage: {
                              value: "예약번호를 알려주세요.",
                            },
                          },
                        },
                      ],
                      maxRetries: 2,
                    },
                  },
                },
              ],
              intentClosingSetting: {
                closingResponse: {
                  messageGroupsList: [
                    {
                      message: {
                        plainTextMessage: {
                          value:
                            "부가 서비스 요청을 접수했습니다. 확인 후 연락드리겠습니다.",
                        },
                      },
                    },
                  ],
                },
              },
            },
            // FallbackIntent
            {
              name: "FallbackIntent",
              description: "기본 폴백 인텐트",
              parentIntentSignature: "AMAZON.FallbackIntent",
              intentClosingSetting: {
                closingResponse: {
                  messageGroupsList: [
                    {
                      message: {
                        plainTextMessage: {
                          value:
                            "죄송합니다. 이해하지 못했습니다. 예약 변경, 트러블 신고, 또는 부가 서비스 요청 중 하나를 선택해주세요.",
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    });

    this.botId = this.bot.ref;

    // 봇 버전 생성
    const botVersion = new lex.CfnBotVersion(this, "BotVersion", {
      botId: this.bot.ref,
      botVersionLocaleSpecification: [
        {
          localeId: "ko_KR",
          botVersionLocaleDetails: {
            sourceBotVersion: "DRAFT",
          },
        },
      ],
    });

    botVersion.addDependency(this.bot);

    // 봇 별칭 생성 (demo)
    this.botAlias = new lex.CfnBotAlias(this, "DemoAlias", {
      botId: this.bot.ref,
      botAliasName: "demo",
      description: "데모 환경용 봇 별칭",
      botVersion: botVersion.attrBotVersion,
    });

    this.botAlias.addDependency(botVersion);
    this.botAliasId = this.botAlias.attrBotAliasId;

    // 출력
    new cdk.CfnOutput(this, "BotId", {
      value: this.botId,
      description: "Lex Bot ID",
      exportName: "PartnerConfirmation-BotId",
    });

    new cdk.CfnOutput(this, "BotAliasId", {
      value: this.botAliasId,
      description: "Lex Bot Alias ID",
      exportName: "PartnerConfirmation-BotAliasId",
    });

    new cdk.CfnOutput(this, "LocaleId", {
      value: "ko_KR",
      description: "Lex Bot Locale ID",
      exportName: "PartnerConfirmation-LocaleId",
    });
  }
}
